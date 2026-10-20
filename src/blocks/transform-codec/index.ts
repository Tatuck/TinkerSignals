import { dct, idct } from '@/engine/dsp/dct';
import { snr } from '@/engine/dsp/metrics';
import { quantizeSymmetric } from '@/engine/dsp/quantize';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock, type InteriorGraph } from '@/engine/types';

const SIZES = ['16', '32', '64', '128', '256', '512', '1024'] as const;
const SCALE_BITS = 16;

/**
 * Codificación por transformada: DCT por bloques, se quedan K coeficientes
 * y se cuantizan con b bits. Codifica y decodifica dentro del bloque para
 * enseñar a la vez la calidad, la tasa y el retardo.
 */
export default defineBlock({
  id: 'transform-codec',
  category: 'perceptual',
  icon: '🧮',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    blockSize: { type: 'select', default: '64', options: SIZES },
    keep: { type: 'number', default: 25, min: 1, max: 100, step: 1, unit: '%' },
    selection: { type: 'select', default: 'largest', options: ['low', 'largest'] },
    bits: { type: 'number', default: 6, min: 1, max: 16, step: 1, unit: 'bits' },
  },
  interior: (p): InteriorGraph => ({
    nodes: [
      { id: 'in', type: 'inner-signal-in', x: 0, y: 60 },
      { id: 'frames', type: 'framer', x: 300, y: 40, params: { exactSize: Number(p.blockSize), exactHop: Number(p.blockSize), window: 'rect' } },
      { id: 'dct', type: 'dct', x: 600, y: 20 },
      { id: 'sel', type: 'coef-select', x: 900, y: 0, params: { keep: p.keep, selection: p.selection } },
      { id: 'q', type: 'frame-quantizer', x: 900, y: 300, params: { bits: p.bits } },
      { id: 'idct', type: 'idct', x: 600, y: 320 },
      { id: 'join', type: 'overlap-add', x: 300, y: 340 },
    ],
    edges: [
      ['in', 'out', 'frames', 'in'],
      ['frames', 'out', 'dct', 'in'],
      ['dct', 'out', 'sel', 'in'],
      ['sel', 'out', 'q', 'in'],
      ['q', 'out', 'idct', 'in'],
      ['idct', 'out', 'join', 'in'],
    ],
    inputs: { in: 'in' },
    outputs: { out: ['join', 'out'] },
  }),
  inspectAt({ inputs, params, timeS }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const N = Number(params.blockSize);
    const start = Math.floor((timeS * fs) / N) * N;
    const c = dct(Float64Array.from({ length: N }, (_, i) => x[start + i] ?? 0));
    const K = Math.max(1, Math.round((N * params.keep) / 100));
    const kept = new Set(
      params.selection === 'low'
        ? Array.from({ length: K }, (_, k) => k)
        : Array.from({ length: N }, (_, k) => k)
            .sort((a, b) => Math.abs(c[b]) - Math.abs(c[a]))
            .slice(0, K),
    );
    const show = Math.min(N, 64);
    return [
      {
        kind: 'bars',
        title: 'coefficientsAt',
        values: Array.from({ length: show }, (_, k) => Math.abs(c[k])),
        highlight: [...kept].filter((k) => k < show),
        labels: Array.from({ length: show }, (_, k) => `Coeficiente ${k}: ${c[k].toFixed(3)}${kept.has(k) ? ' (se conserva)' : ''}`),
      },
    ];
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const N = Number(params.blockSize);
    const K = Math.max(1, Math.round((N * params.keep) / 100));
    const posBits = params.selection === 'largest' && K < N ? Math.ceil(Math.log2(N)) : 0;

    const y = new Float32Array(x.length);
    const energy = new Float64Array(N);
    const block = new Float64Array(N);
    const coeffs = new Float64Array(N);
    let totalBits = 0;
    let blocks = 0;

    for (let start = 0; start < x.length; start += N) {
      for (let i = 0; i < N; i++) block[i] = x[start + i] ?? 0;
      dct(block, coeffs);
      for (let k = 0; k < N; k++) energy[k] += coeffs[k] * coeffs[k];

      const order =
        params.selection === 'low'
          ? Array.from({ length: K }, (_, k) => k)
          : Array.from({ length: N }, (_, k) => k)
              .sort((a, b) => Math.abs(coeffs[b]) - Math.abs(coeffs[a]))
              .slice(0, K);
      let scale = 0;
      for (const k of order) scale = Math.max(scale, Math.abs(coeffs[k]));
      const kept = new Float64Array(N);
      for (const k of order) kept[k] = quantizeSymmetric(coeffs[k], scale, params.bits);
      idct(kept, block);
      for (let i = 0; i < N && start + i < x.length; i++) y[start + i] = block[i];
      totalBits += SCALE_BITS + K * (params.bits + posBits);
      blocks++;
    }

    // Energía media por coeficiente, agrupada en como mucho 64 barras.
    const groups = Math.min(64, N);
    const per = N / groups;
    const bars = Array.from({ length: groups }, (_, g) => {
      let s = 0;
      for (let k = g * per; k < (g + 1) * per; k++) s += energy[k];
      return 10 * Math.log10(s / blocks / per + 1e-12) + 120;
    });
    const highlight =
      params.selection === 'low'
        ? Array.from({ length: Math.ceil(K / per) }, (_, g) => g)
        : bars
            .map((v, g) => [v, g] as const)
            .sort((a, b) => b[0] - a[0])
            .slice(0, Math.ceil(K / per))
            .map(([, g]) => g);

    const latencyMs = (N / fs) * 1000;
    const bitrate = (totalBits * fs) / x.length;
    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [
        { key: 'snr', value: snr(x, y), unit: 'dB', highlight: true },
        { key: 'bitrate', value: bitrate, unit: 'bps', highlight: true },
        { key: 'compression', value: (16 * fs) / bitrate, unit: '×' },
        { key: 'blockSize', value: N, unit: 'muestras' },
        { key: 'kept', value: K, unit: `de ${N}` },
      ],
      plots: [
        compareWaves(x, y, fs),
        { kind: 'bars', title: 'energy', values: bars.map((v) => Math.max(0, v)), highlight },
      ],
      latencyMs,
    };
  },
});

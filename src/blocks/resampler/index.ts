import { averageSpectrumDb } from '@/engine/dsp/fft';
import { convolveSame, firResponseDb, lowpassFir } from '@/engine/dsp/filters';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock, type InteriorGraph } from '@/engine/types';

const RATES = ['4000', '8000', '11025', '16000', '22050', '32000', '44100', '48000'] as const;
const TAPS = { gentle: 31, normal: 101, steep: 301 } as const;

/**
 * Muestreador: filtro antialiasing (paso bajo FIR) + cambio de frecuencia de
 * muestreo. La entrada hace de señal "analógica" (muestreada mucho más rápido).
 */
export default defineBlock({
  id: 'resampler',
  category: 'digitalizacion',
  icon: '⏱️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    sampleRate: { type: 'select', default: '8000', options: RATES },
    antialias: { type: 'boolean', default: true },
    cutoffMode: {
      type: 'select',
      default: 'auto',
      options: ['auto', 'manual'],
      visibleIf: { param: 'antialias', equals: [true] },
    },
    cutoff: {
      type: 'number',
      default: 3400,
      min: 100,
      max: 22000,
      step: 10,
      unit: 'Hz',
      scale: 'log',
      visibleIf: { param: 'cutoffMode', equals: ['manual'] },
    },
    steepness: {
      type: 'select',
      default: 'normal',
      options: ['gentle', 'normal', 'steep'],
      visibleIf: { param: 'antialias', equals: [true] },
    },
  },
  interior: (p, inputs): InteriorGraph => {
    const fsIn = inputs.in?.kind === 'signal' ? inputs.in.sampleRate : 16000;
    const fsOut = Number(p.sampleRate);
    const down = fsOut < fsIn;
    const cutoff = p.cutoffMode === 'manual' ? p.cutoff : 0.45 * Math.min(fsIn, fsOut);
    const filter = {
      id: 'aa',
      type: 'fir-filter',
      params: { type: 'lowpass', cutoff: Math.round(cutoff), taps: TAPS[p.steepness] },
    };
    const sample = { id: 'rate', type: 'rate-change', params: { exactRate: fsOut } };
    if (!p.antialias || fsOut === fsIn) {
      return {
        nodes: [
          { id: 'in', type: 'inner-signal-in', x: 0, y: 40 },
          { ...sample, x: 300, y: 20 },
        ],
        edges: [['in', 'out', 'rate', 'in']],
        inputs: { in: 'in' },
        outputs: { out: ['rate', 'out'] },
      };
    }
    // Al bajar: filtrar y luego tomar muestras. Al subir: al revés.
    const [first, second] = down ? [filter, sample] : [sample, filter];
    return {
      nodes: [
        { id: 'in', type: 'inner-signal-in', x: 0, y: 40 },
        { ...first, x: 300, y: 0 },
        { ...second, x: 620, y: 20 },
      ],
      edges: [
        ['in', 'out', first.id, 'in'],
        [first.id, 'out', second.id, 'in'],
      ],
      inputs: { in: 'in' },
      outputs: { out: [second.id, 'out'] },
    };
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fsIn } = inputs.in;
    const fsOut = Number(params.sampleRate);
    const ratio = fsOut / fsIn;
    const taps = TAPS[params.steepness];
    // El filtro trabaja a la frecuencia más alta de las dos.
    const fsFilter = Math.max(fsIn, fsOut);
    const fc = Math.min(
      params.cutoffMode === 'manual' ? params.cutoff : 0.45 * Math.min(fsIn, fsOut),
      0.499 * fsFilter,
    );
    const h = lowpassFir(fc / fsFilter, taps);

    // Al bajar la fs, se filtra ANTES de tomar las muestras (antialiasing).
    const src = params.antialias && ratio < 1 ? convolveSame(x, h) : x;
    const n = Math.max(1, Math.floor(x.length * ratio));
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / ratio;
      const i0 = Math.floor(t);
      const f = t - i0;
      y[i] = (src[i0] ?? 0) * (1 - f) + (src[i0 + 1] ?? src[i0] ?? 0) * f;
    }
    // Al subirla, se filtra DESPUÉS para quitar las imágenes de la interpolación.
    const out = params.antialias && ratio > 1 ? convolveSame(y, h) : y;

    const specIn = averageSpectrumDb(x, 512);
    const specOut = averageSpectrumDb(out, 512);
    const hz = (len: number, fs: number) =>
      Array.from({ length: len }, (_, k) => (k * fs) / (2 * len));
    const resp = firResponseDb(h, 160);
    const series: Extract<import('@/engine/types').Plot, { kind: 'line' }>['series'] = [
      { role: 'in', x: hz(specIn.length, fsIn), y: specIn },
      { role: 'out', x: hz(specOut.length, fsOut), y: specOut },
      // Línea vertical en la nueva fs/2: todo lo que haya a su derecha se dobla.
      { role: 'error', x: [fsOut / 2, fsOut / 2], y: [-90, 0] },
    ];
    if (params.antialias)
      series.splice(2, 0, { role: 'aux', x: hz(resp.length, fsFilter), y: resp });

    return {
      outputs: { out: makeSignal(out, fsOut) },
      metrics: [
        { key: 'sampleRate', value: fsOut, unit: 'Hz', highlight: true },
        { key: 'nyquist', value: fsOut / 2, unit: 'Hz', highlight: true },
        ...(params.antialias ? [{ key: 'cutoff', value: fc, unit: 'Hz' }] : []),
        { key: 'ratio', value: ratio, unit: '×' },
      ],
      // Un FIR de N coeficientes retrasa (N-1)/2 muestras en un sistema real.
      latencyMs: params.antialias && ratio !== 1 ? (((taps - 1) / 2) * 1000) / fsFilter : 0,
      plots: [
        {
          kind: 'line',
          title: 'spectrum',
          series,
          xLabel: 'f',
          yLabel: 'dB',
          yRange: [-90, 0],
        },
      ],
    };
  },
});

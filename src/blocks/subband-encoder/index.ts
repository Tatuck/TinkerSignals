import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { averageSpectrumDb } from '@/engine/dsp/fft';
import { snr } from '@/engine/dsp/metrics';
import { defineBlock, type InteriorGraph } from '@/engine/types';
import { QMF_TAPS, subbandEncode } from '../_shared/subband';

/** Modos de G.722: bits de la banda baja (la alta siempre lleva 2). */
const MODES = { '64': 6, '56': 5, '48': 4 } as const;

export default defineBlock({
  id: 'subband-encoder',
  category: 'perceptual',
  family: 'g722',
  familyRole: 'encoder',
  icon: '🎚️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    mode: { type: 'select', default: '64', options: Object.keys(MODES) as (keyof typeof MODES)[] },
  },
  interior: (p, inputs): InteriorGraph => {
    const fs = inputs.in?.kind === 'signal' ? inputs.in.sampleRate : 16000;
    const n = inputs.in?.kind === 'signal' ? inputs.in.length : 0;
    const lowBits = MODES[p.mode];
    return {
      nodes: [
        { id: 'in', type: 'inner-signal-in', x: 0, y: 200 },
        { id: 'h0', type: 'fir-filter', x: 300, y: 0, params: { type: 'qmf-low' } },
        { id: 'd0', type: 'rate-change', x: 600, y: 0, params: { exactRate: fs / 2 } },
        { id: 'a0', type: 'band-adpcm', x: 900, y: 0, params: { bits: lowBits, predictor: 'low' } },
        { id: 'u0', type: 'upsample', x: 1200, y: 0, params: { factor: 2, length: n + QMF_TAPS - 1 } },
        { id: 'g0', type: 'fir-filter', x: 1500, y: 0, params: { type: 'qmf-low', gain: 2 } },
        { id: 'h1', type: 'fir-filter', x: 300, y: 420, params: { type: 'qmf-high' } },
        { id: 'd1', type: 'rate-change', x: 600, y: 420, params: { exactRate: fs / 2 } },
        { id: 'a1', type: 'band-adpcm', x: 900, y: 420, params: { bits: 2, predictor: 'high' } },
        { id: 'u1', type: 'upsample', x: 1200, y: 420, params: { factor: 2, length: n + QMF_TAPS - 1 } },
        { id: 'g1', type: 'fir-filter', x: 1500, y: 420, params: { type: 'qmf-high', gain: -2 } },
        { id: 'sum', type: 'adder', x: 1800, y: 200 },
        { id: 'align', type: 'delay', x: 2100, y: 200, params: { samples: -(QMF_TAPS - 1), length: n } },
      ],
      edges: [
        ['in', 'out', 'h0', 'in'],
        ['h0', 'out', 'd0', 'in'],
        ['d0', 'out', 'a0', 'in'],
        ['a0', 'out', 'u0', 'in'],
        ['u0', 'out', 'g0', 'in'],
        ['in', 'out', 'h1', 'in'],
        ['h1', 'out', 'd1', 'in'],
        ['d1', 'out', 'a1', 'in'],
        ['a1', 'out', 'u1', 'in'],
        ['u1', 'out', 'g1', 'in'],
        ['g0', 'out', 'sum', 'a'],
        ['g1', 'out', 'sum', 'b'],
        ['sum', 'out', 'align', 'in'],
      ],
      inputs: { in: 'in' },
      outputs: {},
    };
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const lowBits = MODES[params.mode];
    const highBits = 2;
    const enc = subbandEncode(x, lowBits, highBits);
    const out = makeBitstream(
      enc.writer,
      { codec: 'subband', sampleRate: fs, numSamples: x.length, lowBits, highBits },
      referenceBitsFor(x.length),
    );
    const specIn = averageSpectrumDb(x, 512);
    const specOut = averageSpectrumDb(enc.reconstructed, 512);
    const hz = Array.from({ length: specIn.length }, (_, k) => (k * fs) / (2 * specIn.length));
    return {
      outputs: { out },
      metrics: [
        { key: 'bitrate', value: ((lowBits + highBits) * fs) / 2, unit: 'bps', highlight: true },
        { key: 'snrExpected', value: snr(x, enc.reconstructed), unit: 'dB', highlight: true },
        { key: 'lowEnergy', value: enc.lowEnergyPct, unit: '%' },
        { key: 'lowBits', value: lowBits, unit: 'bits' },
        { key: 'highBits', value: highBits, unit: 'bits' },
      ],
      // Filtros QMF de análisis y síntesis: (N−1)/2 muestras cada uno.
      latencyMs: ((QMF_TAPS - 1) / fs) * 1000,
      plots: [
        {
          kind: 'line',
          title: 'spectrum',
          series: [
            { role: 'in', x: hz, y: specIn },
            { role: 'out', x: hz, y: specOut },
            { role: 'error', x: [fs / 4, fs / 4], y: [-90, 0] },
          ],
          xLabel: 'f',
          yLabel: 'dB',
          yRange: [-90, 0],
        },
      ],
    };
  },
});

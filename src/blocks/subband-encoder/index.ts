import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { averageSpectrumDb } from '@/engine/dsp/fft';
import { snr } from '@/engine/dsp/metrics';
import { defineBlock } from '@/engine/types';
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

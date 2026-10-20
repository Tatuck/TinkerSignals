import { defineBlock } from '@/engine/types';
import { BANDS, FRAME, psychoacoustic } from '../_shared/mpeg1';

/** Modelo psicoacústico: cuánto se puede «esconder» en cada subbanda (SMR). */
export default defineBlock({
  id: 'psychoacoustic-model',
  category: 'piezas',
  icon: '👂',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'frames' } },
  params: {},
  process({ inputs }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const frames = Math.ceil((x.length + BANDS) / FRAME);
    const data: Float32Array[] = [];
    let sample = psychoacoustic(x, 0, fs);
    let bestE = -1;
    for (let f = 0; f < frames; f++) {
      const pa = psychoacoustic(x, f * FRAME, fs);
      data.push(Float32Array.from(pa.smr));
      const e = pa.spectrum.reduce((s, v) => s + 10 ** (v / 10), 0);
      if (e > bestE) {
        bestE = e;
        sample = pa;
      }
    }
    const hz = Array.from(
      { length: sample.spectrum.length },
      (_, k) => (k * fs) / (2 * sample.spectrum.length),
    );
    return {
      outputs: {
        out: {
          kind: 'frames',
          domain: 'smr',
          sampleRate: fs,
          hop: FRAME,
          size: BANDS,
          numSamples: x.length,
          data,
        },
      },
      plots: [
        {
          kind: 'line',
          title: 'masking',
          series: [
            { role: 'in', x: hz, y: Array.from(sample.spectrum) },
            { role: 'out', x: hz, y: Array.from(sample.threshold) },
          ],
          xLabel: 'f',
          yLabel: 'dB',
          yRange: [-10, 100],
        },
      ],
      latencyMs: ((512 - FRAME) / 2 / fs) * 1000,
    };
  },
});

import { detectPitch, frameAt } from '@/engine/dsp/voice';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'voice-analysis',
  category: 'voz',
  icon: '🗣️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    frameMs: { type: 'number', default: 20, min: 5, max: 50, step: 1, unit: 'ms' },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const N = Math.max(16, Math.round((params.frameMs / 1000) * fs));
    const energy: number[] = [];
    const zcr: number[] = [];
    const voiced: number[] = [];
    let pitchSum = 0;
    let voicedCount = 0;

    for (let start = 0; start + N <= x.length; start += N) {
      const f = frameAt(x, start, N);
      let e = 0;
      let z = 0;
      for (let i = 0; i < N; i++) {
        e += f[i] * f[i];
        if (i && Math.sign(f[i]) !== Math.sign(f[i - 1])) z++;
      }
      energy.push(10 * Math.log10(e / N + 1e-10));
      zcr.push(z / N);
      const p = detectPitch(f, fs);
      voiced.push(p.voiced ? 1 : 0);
      if (p.voiced) {
        pitchSum += fs / p.lag;
        voicedCount++;
      }
    }

    // Todo normalizado a [0, 1] para poder verlo en una sola gráfica.
    const eMax = Math.max(...energy);
    const eN = energy.map((v) => Math.max(0, 1 + (v - eMax) / 60));
    const zMax = Math.max(1e-9, ...zcr);
    return {
      outputs: { out: inputs.in },
      metrics: [
        { key: 'voicedPct', value: (100 * voicedCount) / Math.max(1, voiced.length), unit: '%', highlight: true },
        { key: 'f0', value: voicedCount ? pitchSum / voicedCount : 0, unit: 'Hz', highlight: true },
        { key: 'frames', value: voiced.length },
      ],
      plots: [
        {
          kind: 'line',
          title: 'features',
          series: [
            { role: 'aux', y: voiced.map((v) => v * 0.98), style: 'step' },
            { role: 'out', y: eN },
            { role: 'in', y: zcr.map((v) => v / zMax) },
          ],
          yRange: [0, 1],
        },
      ],
    };
  },
});

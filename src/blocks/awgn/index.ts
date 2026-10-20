import { rms, snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { gaussian, seededRandom } from '../_shared/random';

export default defineBlock({
  id: 'awgn',
  category: 'canal',
  icon: '🌫️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    snr: { type: 'number', default: 20, min: -10, max: 60, step: 1, unit: 'dB' },
    seed: { type: 'number', default: 1, min: 1, max: 999, step: 1 },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const sigma = rms(x) / Math.pow(10, params.snr / 20);
    const rand = seededRandom(params.seed);
    const y = x.map((v) => v + sigma * gaussian(rand));
    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [{ key: 'snr', value: snr(x, y), unit: 'dB', highlight: true }],
      plots: [compareWaves(x, y, fs)],
    };
  },
});

import { describe, expect, it } from 'vitest';
import { snr } from './metrics';
import { overlapAdd, toFrames } from './frames';

describe('tramas', () => {
  const x = { kind: 'signal' as const, sampleRate: 8000, samples: Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.05)) };
  it.each([
    ['rect', 64, 64],
    ['hann', 64, 32],
    ['sine', 128, 64],
  ] as const)('trocear con %s y unir reconstruye la señal', (w, size, hop) => {
    const y = overlapAdd(toFrames(x, size, hop, w));
    expect(snr(x.samples.subarray(0, 900), y.samples.subarray(0, 900))).toBeGreaterThan(80);
  });
});

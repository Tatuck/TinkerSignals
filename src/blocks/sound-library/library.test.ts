import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECORDINGS } from './recordings';
import { SYNTH_SOUNDS } from './synth';

describe('biblioteca de sonidos', () => {
  it.each(Object.entries(RECORDINGS))('la grabación «%s» existe en public/sounds', (_, r) => {
    expect(existsSync(`public/sounds/${r.file}`)).toBe(true);
  });

  it.each(Object.entries(SYNTH_SOUNDS))('el sonido sintético «%s» es audio válido', (_, s) => {
    const x = s.make(s.sampleRate);
    expect(x.length).toBeGreaterThan(s.sampleRate);
    let peak = 0;
    for (const v of x) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThanOrEqual(1);
  });
});

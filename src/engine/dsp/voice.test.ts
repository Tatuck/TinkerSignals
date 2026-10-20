import { describe, expect, it } from 'vitest';
import { levinson, autocorrelation } from './lpc';
import { detectPitch, reflectionToLpc } from './voice';

describe('voz', () => {
  it('detecta el tono de un tren de pulsos filtrado', () => {
    const fs = 8000;
    const lag = 57; // ~140 Hz
    const x = new Float64Array(400);
    let y1 = 0;
    for (let i = 0; i < x.length; i++) {
      const e = i % lag === 0 ? 1 : 0;
      y1 = e + 0.9 * y1;
      x[i] = y1;
    }
    const p = detectPitch(x, fs);
    expect(p.voiced).toBe(true);
    expect(p.lag).toBe(lag);
  });

  it('el ruido blanco se clasifica como sordo', () => {
    let s = 7;
    const x = Float64Array.from({ length: 320 }, () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1);
    expect(detectPitch(x, 8000).voiced).toBe(false);
  });

  it('step-up invierte Levinson', () => {
    const x = Float64Array.from({ length: 500 }, (_, i) => Math.sin(i * 0.3) + 0.5 * Math.sin(i * 1.1));
    const { a, k } = levinson(autocorrelation(x, 6), 6);
    const back = reflectionToLpc(k);
    back.forEach((v, i) => expect(v).toBeCloseTo(a[i], 10));
  });
});

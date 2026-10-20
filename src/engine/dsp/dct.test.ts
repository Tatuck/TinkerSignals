import { describe, expect, it } from 'vitest';
import { __test, dct, idct } from './dct';

describe('DCT', () => {
  const x = Float64Array.from(
    { length: 64 },
    (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1) + (i % 5) * 0.1,
  );

  it('la versión rápida coincide con la fórmula directa', () => {
    const fast = dct(x);
    const slow = __test.dctDirect(x, new Float64Array(64));
    fast.forEach((v, k) => expect(v).toBeCloseTo(slow[k], 9));
  });

  it('idct(dct(x)) = x', () => {
    const back = idct(dct(x));
    back.forEach((v, i) => expect(v).toBeCloseTo(x[i], 9));
  });

  it('es ortonormal: conserva la energía', () => {
    const e = (a: Float64Array) => a.reduce((s, v) => s + v * v, 0);
    expect(e(dct(x))).toBeCloseTo(e(x), 9);
  });
});

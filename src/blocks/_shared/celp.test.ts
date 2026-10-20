import { describe, expect, it } from 'vitest';
import { __test } from './celp';
import { seededRandom } from './random';

const {
  searchAdaptive,
  backwardFilter,
  autocorrelationMatrix,
  makeWorkspace,
  convolve,
  adaptiveVector,
} = __test;
const rand = seededRandom(5);
const randArray = (n: number) => Float64Array.from({ length: n }, () => rand() * 2 - 1);

describe('búsqueda rápida de CELP', () => {
  const L = 40;
  const h = Float64Array.from({ length: L }, (_, n) => 0.9 ** n * Math.cos(n * 0.7));
  const t = randArray(L);

  it('correlación y energía por Φ coinciden con filtrar el vector', () => {
    const dd = new Float64Array(L);
    backwardFilter(t, h, dd);
    const phi = autocorrelationMatrix(h, new Float64Array(L * L));
    const c = new Float64Array(L);
    c[3] = 0.5;
    c[17] = -0.5;
    c[39] = 0.5;
    const y = convolve(h, c, new Float64Array(L));
    const corrDirect = y.reduce((s, v, n) => s + v * t[n], 0);
    const energyDirect = y.reduce((s, v) => s + v * v, 0);
    let corr = 0;
    let energy = 0;
    for (let i = 0; i < L; i++) {
      corr += c[i] * dd[i];
      for (let j = 0; j < L; j++) energy += c[i] * c[j] * phi[i * L + j];
    }
    expect(corr).toBeCloseTo(corrDirect, 10);
    expect(energy).toBeCloseTo(energyDirect, 10);
  });

  it('el libro adaptativo elige el mismo retardo que la búsqueda exhaustiva', () => {
    const history = randArray(200);
    const best = searchAdaptive(history, h, t, 20, 147, L, makeWorkspace(L));
    let bestT = 0;
    let bestScore = -1;
    for (let T = 20; T <= 147; T++) {
      const y = convolve(h, adaptiveVector(history, T, L), new Float64Array(L));
      const ty = y.reduce((s, v, n) => s + v * t[n], 0);
      const yy = y.reduce((s, v) => s + v * v, 0);
      if (ty > 0 && (ty * ty) / yy > bestScore) {
        bestScore = (ty * ty) / yy;
        bestT = T;
      }
    }
    expect(best.T).toBe(bestT);
  });
});

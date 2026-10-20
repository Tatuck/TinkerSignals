import { describe, expect, it } from 'vitest';
import { mosFromR, rFactor } from './emodel';

describe('modelo E', () => {
  it('G.711 sin retardo ni pérdidas da la calidad máxima (R ≈ 93, MOS ≈ 4,4)', () => {
    const r = rFactor(0, 0, 25.1, 0);
    expect(r).toBeCloseTo(93.2, 1);
    expect(mosFromR(r)).toBeCloseTo(4.41, 1);
  });

  it('el retardo penaliza mucho más pasados ~177 ms', () => {
    const slope1 = rFactor(100, 0, 25, 0) - rFactor(150, 0, 25, 0);
    const slope2 = rFactor(250, 0, 25, 0) - rFactor(300, 0, 25, 0);
    expect(slope2).toBeGreaterThan(slope1 * 3);
  });

  it('las pérdidas a ráfagas pesan más que al azar', () => {
    expect(rFactor(50, 11, 19, 5, 2)).toBeLessThan(rFactor(50, 11, 19, 5, 1));
  });

  it('MOS está acotado entre 1 y 4,5', () => {
    expect(mosFromR(-20)).toBe(1);
    expect(mosFromR(120)).toBe(4.5);
  });
});

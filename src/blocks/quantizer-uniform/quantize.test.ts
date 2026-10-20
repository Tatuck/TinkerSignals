import { describe, expect, it } from 'vitest';
import { snr } from '@/engine/dsp/metrics';
import { quantizeUniform } from '@/engine/dsp/quantize';

describe('cuantizador uniforme', () => {
  const fs = 8000;
  const sine = Float32Array.from({ length: fs }, (_, i) => 0.999 * Math.sin((2 * Math.PI * 101 * i) / fs));

  it.each([4, 8, 12])('cumple SNR ≈ 6,02·n + 1,76 dB con %i bits', (bits) => {
    const s = snr(sine, quantizeUniform(sine, bits, 'midrise'));
    expect(s).toBeGreaterThan(6.02 * bits + 1.76 - 1);
    expect(s).toBeLessThan(6.02 * bits + 1.76 + 1);
  });

  it('mid-tread conserva el silencio y mid-rise no', () => {
    const zeros = new Float32Array(4);
    expect([...quantizeUniform(zeros, 3, 'midtread')]).toEqual([0, 0, 0, 0]);
    expect(quantizeUniform(zeros, 3, 'midrise')[0]).not.toBe(0);
  });

  it('usa exactamente 2^n niveles', () => {
    const ramp = Float32Array.from({ length: 1000 }, (_, i) => -1 + (2 * i) / 999);
    expect(new Set(quantizeUniform(ramp, 3, 'midrise')).size).toBe(8);
  });
});

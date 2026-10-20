import { describe, expect, it } from 'vitest';
import { snr } from '@/engine/dsp/metrics';
import { absoluteThreshold, analysis, mpeg1Decode, mpeg1Encode, synthesis } from './mpeg1';
import { qmfMerge, qmfSplit } from './subband';

const fs = 32000;
const music = Float32Array.from({ length: fs * 2 }, (_, i) => {
  const t = i / fs;
  return (
    0.4 * Math.sin(2 * Math.PI * 440 * t) +
    0.2 * Math.sin(2 * Math.PI * 1320 * t) +
    0.1 * Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-((t % 0.5) * 6))
  );
});

describe('MPEG-1 Layer I', () => {
  it('el banco de 32 bandas reconstruye perfectamente', () => {
    const y = synthesis(analysis(music), music.length);
    expect(snr(music, y)).toBeGreaterThan(100);
  });

  it('más tasa, más SNR, y el decodificador coincide con el formato', () => {
    const run = (kbps: number) => {
      const { writer } = mpeg1Encode(music, fs, kbps * 1000, true);
      const { bytes, bitLength } = writer.finish();
      expect(bitLength / (music.length / fs)).toBeLessThanOrEqual(kbps * 1000 * 1.01);
      return snr(music, mpeg1Decode(bytes, bitLength, music.length, fs, kbps * 1000));
    };
    const s64 = run(64);
    const s192 = run(192);
    expect(s64).toBeGreaterThan(5);
    expect(s192).toBeGreaterThan(s64 + 6);
  });

  it('el umbral absoluto es mínimo hacia 3–4 kHz', () => {
    expect(absoluteThreshold(3500)).toBeLessThan(absoluteThreshold(100));
    expect(absoluteThreshold(3500)).toBeLessThan(absoluteThreshold(15000));
  });
});

describe('QMF de 2 bandas', () => {
  it('casi reconstruye la señal sin cuantizar', () => {
    const { low, high } = qmfSplit(music);
    expect(snr(music, qmfMerge(low, high, music.length))).toBeGreaterThan(60);
  });
});

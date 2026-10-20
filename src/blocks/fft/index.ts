import { fft, nextPow2 } from '@/engine/dsp/fft';
import { makeWindow } from '@/engine/dsp/frames';
import { defineBlock, type Frames } from '@/engine/types';

/** Espectro por tramas (STFT): la herramienta de diagnóstico más útil. */
export default defineBlock({
  id: 'fft',
  category: 'piezas',
  icon: '📊',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'frames' } },
  params: {
    size: { type: 'select', default: '512', options: ['64', '128', '256', '512', '1024', '2048'] },
    window: { type: 'select', default: 'hann', options: ['rect', 'hann', 'hamming'] },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const N = nextPow2(Number(params.size));
    const hop = N / 2;
    const w = makeWindow(params.window, N);
    let wsum = 0;
    for (const v of w) wsum += v;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const data: Float32Array[] = [];
    const avg = new Float64Array(N / 2);
    for (let start = 0; start < Math.max(1, x.length - N / 2); start += hop) {
      for (let i = 0; i < N; i++) {
        re[i] = (x[start + i] ?? 0) * w[i];
        im[i] = 0;
      }
      fft(re, im);
      const mag = new Float32Array(N / 2);
      for (let k = 0; k < N / 2; k++) {
        // Escala: una senoidal de amplitud 1 da 0 dB.
        const a = (2 * Math.hypot(re[k], im[k])) / wsum;
        mag[k] = 20 * Math.log10(a + 1e-9);
        avg[k] += a * a;
      }
      data.push(mag);
    }
    const out: Frames = { kind: 'frames', domain: 'spectrum', sampleRate: fs, hop, size: N / 2, numSamples: x.length, data };
    const mean = Array.from(avg, (v) => 10 * Math.log10(v / data.length + 1e-18));
    let peak = 0;
    mean.forEach((v, k) => v > mean[peak] && (peak = k));
    const hz = mean.map((_, k) => (k * fs) / N);
    return {
      outputs: { out },
      metrics: [
        { key: 'resolution', value: fs / N, unit: 'Hz', highlight: true },
        { key: 'peakHz', value: hz[peak], unit: 'Hz', highlight: true },
        { key: 'frameMs', value: (1000 * N) / fs, unit: 'ms' },
      ],
      plots: [{ kind: 'line', title: 'spectrum', series: [{ role: 'out', x: hz, y: mean }], xLabel: 'f', yLabel: 'dB' }],
    };
  },
});

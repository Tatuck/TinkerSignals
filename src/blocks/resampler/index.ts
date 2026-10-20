import { averageSpectrumDb } from '@/engine/dsp/fft';
import { convolveSame, lowpassFir } from '@/engine/dsp/filters';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

const RATES = ['4000', '8000', '11025', '16000', '22050', '32000', '44100', '48000'] as const;
const TAPS = 101;

export default defineBlock({
  id: 'resampler',
  category: 'digitalizacion',
  icon: '⏱️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    sampleRate: { type: 'select', default: '8000', options: RATES },
    antialias: { type: 'boolean', default: true },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fsIn } = inputs.in;
    const fsOut = Number(params.sampleRate);
    const ratio = fsOut / fsIn;

    // Filtro antialiasing: elimina lo que esté por encima de la nueva fs/2 antes de diezmar.
    let src = x;
    if (params.antialias && ratio < 1) src = convolveSame(x, lowpassFir(0.45 * ratio, TAPS));

    const n = Math.max(1, Math.floor(x.length * ratio));
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / ratio;
      const i0 = Math.floor(t);
      const f = t - i0;
      y[i] = (src[i0] ?? 0) * (1 - f) + (src[i0 + 1] ?? src[i0] ?? 0) * f;
    }
    // Al subir la frecuencia, el filtro suaviza la interpolación (quita imágenes).
    const out = params.antialias && ratio > 1 ? convolveSame(y, lowpassFir(0.45 / ratio, TAPS)) : y;

    const specIn = averageSpectrumDb(x, 512);
    const specOut = averageSpectrumDb(out, 512);
    const hz = (len: number, fs: number) =>
      Array.from({ length: len }, (_, k) => (k * fs) / (2 * len));
    return {
      outputs: { out: makeSignal(out, fsOut) },
      metrics: [
        { key: 'sampleRate', value: fsOut, unit: 'Hz', highlight: true },
        { key: 'nyquist', value: fsOut / 2, unit: 'Hz', highlight: true },
        { key: 'ratio', value: ratio, unit: '×' },
      ],
      // Un FIR de TAPS coeficientes retrasa (TAPS-1)/2 muestras en un sistema real.
      // El filtro trabaja a la frecuencia más alta de las dos.
      latencyMs:
        params.antialias && ratio !== 1 ? (((TAPS - 1) / 2) * 1000) / Math.max(fsIn, fsOut) : 0,
      plots: [
        {
          kind: 'line',
          title: 'spectrum',
          series: [
            { role: 'in', x: hz(specIn.length, fsIn), y: specIn },
            { role: 'out', x: hz(specOut.length, fsOut), y: specOut },
          ],
          xLabel: 'f',
          yLabel: 'dB',
          yRange: [-90, 0],
        },
      ],
    };
  },
});

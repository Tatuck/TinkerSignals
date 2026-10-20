import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

/** Toma muestras a otra frecuencia (interpolación lineal) sin filtrar nada. */
export default defineBlock({
  id: 'rate-change',
  category: 'piezas',
  icon: '⏱️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    sampleRate: {
      type: 'select',
      default: '8000',
      options: ['4000', '8000', '11025', '16000', '22050', '32000', '44100', '48000'],
    },
    /** Frecuencia exacta en Hz (0 = la de arriba). La fija un circuito interior. */
    exactRate: { type: 'number', default: 0, min: 0, max: 384000, step: 1, hidden: true },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fsIn } = inputs.in;
    const fsOut = params.exactRate || Number(params.sampleRate);
    const ratio = fsOut / fsIn;
    const n = Math.max(1, Math.floor(x.length * ratio));
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / ratio;
      const i0 = Math.floor(t);
      const f = t - i0;
      y[i] = (x[i0] ?? 0) * (1 - f) + (x[i0 + 1] ?? x[i0] ?? 0) * f;
    }
    return {
      outputs: { out: makeSignal(y, fsOut) },
      metrics: [{ key: 'sampleRate', value: fsOut, unit: 'Hz', highlight: true }],
    };
  },
});

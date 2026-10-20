import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

/** ↑M: inserta M−1 ceros entre muestras (sin filtrar: aparecen imágenes del espectro). */
export default defineBlock({
  id: 'upsample',
  category: 'piezas',
  icon: '⏫',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    factor: { type: 'number', default: 2, min: 2, max: 8, step: 1 },
    /** Longitud de salida exacta (0 = M veces la entrada). */
    length: { type: 'number', default: 0, min: 0, max: 1e9, step: 1, hidden: true },
  },
  process({ inputs, params }) {
    const M = params.factor;
    const target = params.length || inputs.in.samples.length * M;
    const y = new Float32Array(target);
    for (let i = 0; i < inputs.in.samples.length && i * M < target; i++) y[i * M] = inputs.in.samples[i];
    return {
      outputs: { out: makeSignal(y, inputs.in.sampleRate * M) },
      metrics: [{ key: 'sampleRate', value: inputs.in.sampleRate * M, unit: 'Hz', highlight: true }],
    };
  },
});

import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'adder',
  category: 'piezas',
  icon: '➕',
  inputs: { a: { type: 'signal' }, b: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    gainA: { type: 'number', default: 1, min: -4, max: 4, step: 0.5 },
    gainB: { type: 'number', default: 1, min: -4, max: 4, step: 0.5 },
  },
  process({ inputs, params }) {
    if (inputs.a.sampleRate !== inputs.b.sampleRate) {
      throw new Error('Las dos señales deben tener la misma frecuencia de muestreo.');
    }
    const n = Math.max(inputs.a.samples.length, inputs.b.samples.length);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++)
      y[i] = params.gainA * (inputs.a.samples[i] ?? 0) + params.gainB * (inputs.b.samples[i] ?? 0);
    return { outputs: { out: makeSignal(y, inputs.a.sampleRate) } };
  },
});

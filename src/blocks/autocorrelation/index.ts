import { mapFrames } from '@/engine/dsp/frames';
import { autocorrelation } from '@/engine/dsp/lpc';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'autocorrelation',
  category: 'piezas',
  icon: '🔄',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {
    order: { type: 'number', default: 10, min: 1, max: 40, step: 1 },
  },
  process({ inputs, params }) {
    if (inputs.in.domain !== 'time') throw new Error('La autocorrelación se calcula sobre tramas de muestras.');
    const out = mapFrames(inputs.in, 'autocorrelation', (f) => Float32Array.from(autocorrelation(f, params.order)));
    return { outputs: { out }, metrics: [{ key: 'lags', value: params.order + 1, highlight: true }] };
  },
});

import { overlapAdd } from '@/engine/dsp/frames';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'overlap-add',
  category: 'piezas',
  icon: '🧩',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    if (inputs.in.domain !== 'time') {
      throw new Error('Estas tramas no son muestras en el tiempo: pásalas antes por la transformada inversa.');
    }
    return { outputs: { out: overlapAdd(inputs.in) } };
  },
});

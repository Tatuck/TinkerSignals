import { idct } from '@/engine/dsp/dct';
import { mapFrames } from '@/engine/dsp/frames';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'idct',
  category: 'piezas',
  family: 'dct',
  familyRole: 'decoder',
  icon: '🧮',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {},
  process({ inputs }) {
    if (inputs.in.domain !== 'dct') throw new Error('La DCT inversa espera coeficientes DCT.');
    return { outputs: { out: mapFrames(inputs.in, 'time', (f) => Float32Array.from(idct(f))) } };
  },
});

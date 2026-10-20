import { defineBlock } from '@/engine/types';
import { synthesis } from '../_shared/mpeg1';

export default defineBlock({
  id: 'mpeg-synthesis',
  category: 'piezas',
  family: 'filterbank',
  familyRole: 'decoder',
  icon: '🎼',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    if (inputs.in.domain !== 'subbands') throw new Error('El banco de síntesis espera subbandas.');
    const blocks = inputs.in.data.map((f) => Float64Array.from(f));
    return {
      outputs: {
        out: {
          kind: 'signal',
          samples: synthesis(blocks, inputs.in.numSamples),
          sampleRate: inputs.in.sampleRate,
        },
      },
    };
  },
});

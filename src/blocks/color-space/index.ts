import { convertColor, expectPixels } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'color-space',
  category: 'imagen',
  icon: '🎨',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {
    to: { type: 'select', default: 'ycbcr', options: ['ycbcr', 'rgb', 'gray'] },
  },
  process({ inputs, params }) {
    expectPixels(inputs.in, 'El cambio de espacio de color');
    const out = convertColor(inputs.in, params.to);
    return { outputs: { out } };
  },
});

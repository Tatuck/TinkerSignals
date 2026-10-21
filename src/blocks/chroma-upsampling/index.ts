import { expectPixels, makeImage, resamplePlane } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'chroma-upsampling',
  category: 'imagen',
  family: 'chroma',
  familyRole: 'decoder',
  icon: '🔺',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {},
  process({ inputs }) {
    const img = inputs.in;
    expectPixels(img, 'La reconstrucción de la crominancia');
    if (img.color !== 'ycbcr') return { outputs: { out: img } };
    const out = makeImage(
      img.planes.map((p) => resamplePlane(p, img.width, img.height)),
      'ycbcr',
    );
    return { outputs: { out } };
  },
});

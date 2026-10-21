import { blockIdctPlane, makeImage } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'block-idct-2d',
  category: 'imagen',
  family: 'dct2d',
  familyRole: 'decoder',
  icon: '▦',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {},
  process({ inputs }) {
    const img = inputs.in;
    if (img.domain !== 'dct' || !img.blockSize) {
      throw new Error('La DCT inversa necesita coeficientes. Conéctala detrás de una DCT 2D.');
    }
    const n = img.blockSize;
    return {
      outputs: {
        out: makeImage(
          img.planes.map((p) => blockIdctPlane(p, n)),
          img.color,
        ),
      },
    };
  },
});

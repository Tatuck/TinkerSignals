import { expectPixels, makeImage, resamplePlane, SUBSAMPLING, toRgba } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'chroma-subsampling',
  category: 'imagen',
  family: 'chroma',
  familyRole: 'encoder',
  icon: '🔻',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {
    scheme: {
      type: 'select',
      default: '4:2:0',
      options: Object.keys(SUBSAMPLING) as (keyof typeof SUBSAMPLING)[],
    },
  },
  process({ inputs, params }) {
    const img = inputs.in;
    expectPixels(img, 'El submuestreo de crominancia');
    if (img.color !== 'ycbcr') {
      throw new Error(
        'El submuestreo trabaja con YCbCr. Pon antes un bloque «Espacio de color» a YCbCr.',
      );
    }
    const [fx, fy] = SUBSAMPLING[params.scheme];
    const cw = Math.ceil(img.width / fx);
    const ch = Math.ceil(img.height / fy);
    const out = makeImage(
      [img.planes[0], resamplePlane(img.planes[1], cw, ch), resamplePlane(img.planes[2], cw, ch)],
      'ycbcr',
    );
    const before = 3 * img.width * img.height;
    const after = img.width * img.height + 2 * cw * ch;
    return {
      outputs: { out },
      metrics: [
        { key: 'saved', value: 100 * (1 - after / before), unit: '%', highlight: true },
        {
          key: 'bitsPerPixel',
          value: (8 * after) / (img.width * img.height),
          unit: 'bits',
          highlight: true,
        },
      ],
      plots: [{ kind: 'image', title: 'result', ...toRgba(out, 128) }],
    };
  },
});

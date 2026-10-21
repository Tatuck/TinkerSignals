import { expectPixels, imageMse, makePlane, planeToRgba, psnrFromMse } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';
import { hideBits, imageToInts, intsToImage, lsbView } from '../_shared/lsb';

export default defineBlock({
  id: 'lsb-hide-image',
  category: 'imagen',
  family: 'lsb-image',
  familyRole: 'encoder',
  icon: '🕵️',
  inputs: { cover: { type: 'image' }, message: { type: 'bitstream' } },
  outputs: { out: { type: 'image' } },
  params: {
    bits: { type: 'number', default: 1, min: 1, max: 4, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const cover = inputs.cover;
    expectPixels(cover, 'La esteganografía');
    if (cover.color === 'ycbcr') {
      throw new Error('Esconde el mensaje en RGB o en grises: pon antes un «Espacio de color».');
    }
    const ints = imageToInts(cover);
    const { usedBits, capacityBits } = hideBits(ints, params.bits, inputs.message);
    const out = intsToImage(cover, ints);
    const p0 = cover.planes[0];
    return {
      outputs: { out },
      metrics: [
        { key: 'used', value: (100 * usedBits) / capacityBits, unit: '%', highlight: true },
        { key: 'psnr', value: psnrFromMse(imageMse(cover, out)), unit: 'dB', highlight: true },
        { key: 'capacity', value: capacityBits / 8 / 1024, unit: 'KB' },
      ],
      plots: [
        {
          kind: 'image',
          title: 'lsb',
          ...planeToRgba(
            makePlane(p0.width, p0.height, lsbView(ints.subarray(0, p0.data.length), params.bits)),
            256,
          ),
        },
      ],
    };
  },
});

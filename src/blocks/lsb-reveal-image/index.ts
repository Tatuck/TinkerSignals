import { expectPixels, makePlane, planeToRgba } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';
import { imageToInts, lsbView, revealBits } from '../_shared/lsb';

export default defineBlock({
  id: 'lsb-reveal-image',
  category: 'imagen',
  family: 'lsb-image',
  familyRole: 'decoder',
  icon: '🕵️',
  inputs: { in: { type: 'image' } },
  outputs: { message: { type: 'bitstream' } },
  params: {
    bits: { type: 'number', default: 1, min: 1, max: 4, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    expectPixels(inputs.in, 'El revelador');
    const ints = imageToInts(inputs.in);
    const message = revealBits(ints, params.bits);
    const p0 = inputs.in.planes[0];
    return {
      outputs: { message },
      metrics: [{ key: 'recovered', value: message.bitLength, unit: 'bits', highlight: true }],
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

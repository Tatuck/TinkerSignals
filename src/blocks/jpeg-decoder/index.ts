import { expectCodec } from '@/engine/dsp/bitstream';
import { defineBlock } from '@/engine/types';
import { jpegDecode } from '../_shared/jpeg';

export default defineBlock({
  id: 'jpeg-decoder',
  category: 'imagen',
  family: 'jpeg',
  familyRole: 'decoder',
  icon: '🗜️',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'image' } },
  params: {},
  process({ inputs }) {
    expectCodec(inputs.in, 'jpeg', 'El decodificador JPEG');
    const d = jpegDecode(inputs.in.bytes, inputs.in.bitLength);
    return {
      outputs: { out: d.image },
      metrics: [
        { key: 'quality', value: d.quality, highlight: true },
        { key: 'badCodes', value: d.badCodes, highlight: d.badCodes > 0 },
      ],
    };
  },
});

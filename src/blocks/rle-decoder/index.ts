import { expectCodec } from '@/engine/dsp/bitstream';
import { defineBlock } from '@/engine/types';
import { rleDecode } from '../_shared/rle';
import { unwrap } from '../_shared/symbols';

export default defineBlock({
  id: 'rle-decoder',
  category: 'sin-perdidas',
  family: 'rle',
  familyRole: 'decoder',
  icon: '🔁',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'rle', 'El decodificador RLE');
    return { outputs: { out: unwrap(b, rleDecode(b.bytes, b.bitLength)) } };
  },
});

import { expectCodec } from '@/engine/dsp/bitstream';
import { defineBlock } from '@/engine/types';
import { lzwDecode } from '../_shared/lzw';
import { unwrap } from '../_shared/symbols';

export default defineBlock({
  id: 'lzw-decoder',
  category: 'sin-perdidas',
  family: 'lzw',
  familyRole: 'decoder',
  icon: '📖',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'lzw', 'El decodificador LZW');
    return { outputs: { out: unwrap(b, lzwDecode(b.bytes, b.bitLength)) } };
  },
});

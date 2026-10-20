import { expectCodec } from '@/engine/dsp/bitstream';
import { defineBlock } from '@/engine/types';
import { arithmeticDecode } from '../_shared/arithmetic';
import { unwrap } from '../_shared/symbols';

export default defineBlock({
  id: 'arithmetic-decoder',
  category: 'sin-perdidas',
  family: 'arithmetic',
  familyRole: 'decoder',
  icon: '➗',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'arithmetic', 'El decodificador aritmético');
    return { outputs: { out: unwrap(b, arithmeticDecode(b.bytes, b.bitLength)) } };
  },
});

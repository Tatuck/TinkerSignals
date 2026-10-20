import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { dpcmDecode } from '../_shared/dpcm';

export default defineBlock({
  id: 'dpcm-decoder',
  category: 'diferencial',
  icon: '➕',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'dpcm', 'El decodificador DPCM');
    const y = dpcmDecode(b.bytes, b.bitLength, b.header.numSamples, b.header.bits as number);
    return { outputs: { out: makeSignal(y, b.header.sampleRate) } };
  },
});

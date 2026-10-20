import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { mpeg1Decode } from '../_shared/mpeg1';

export default defineBlock({
  id: 'mpeg1-decoder',
  category: 'perceptual',
  family: 'mpeg1',
  familyRole: 'decoder',
  icon: '👂',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'mpeg1-l1', 'El decodificador MPEG-1');
    const h = b.header;
    const y = mpeg1Decode(b.bytes, b.bitLength, h.numSamples, h.sampleRate, h.bitrate as number);
    return { outputs: { out: makeSignal(y, h.sampleRate) } };
  },
});

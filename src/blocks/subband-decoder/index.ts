import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { subbandDecode } from '../_shared/subband';

export default defineBlock({
  id: 'subband-decoder',
  category: 'perceptual',
  family: 'g722',
  familyRole: 'decoder',
  icon: '🎚️',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'subband', 'El decodificador de subbandas');
    const h = b.header as typeof b.header & { lowBits: number; highBits: number };
    const y = subbandDecode(b.bytes, b.bitLength, h.numSamples, h.lowBits, h.highBits);
    return { outputs: { out: makeSignal(y, h.sampleRate) } };
  },
});

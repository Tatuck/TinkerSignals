import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { celpDecode, type CelpConfig } from '../_shared/celp';

export default defineBlock({
  id: 'celp-decoder',
  category: 'voz',
  family: 'celp',
  familyRole: 'decoder',
  icon: '📚',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' }, excitation: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'celp', 'El decodificador CELP');
    const h = b.header as typeof b.header & CelpConfig;
    const { y, excitation } = celpDecode(b.bytes, b.bitLength, h.numSamples, h);
    return {
      outputs: {
        out: makeSignal(y, h.sampleRate),
        excitation: makeSignal(excitation, h.sampleRate),
      },
    };
  },
});

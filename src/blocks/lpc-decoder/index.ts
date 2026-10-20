import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { lpcDecode, type LpcConfig } from '../_shared/lpc-vocoder';

export default defineBlock({
  id: 'lpc-decoder',
  category: 'voz',
  icon: '🗣️',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' }, excitation: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'lpc', 'El decodificador LPC');
    const h = b.header as typeof b.header & LpcConfig;
    const { y, excitation } = lpcDecode(b.bytes, b.bitLength, h.numSamples, h);
    return {
      outputs: {
        out: makeSignal(y, h.sampleRate),
        excitation: makeSignal(excitation, h.sampleRate),
      },
    };
  },
});

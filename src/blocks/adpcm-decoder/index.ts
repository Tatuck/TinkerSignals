import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { adpcmDecode } from '../_shared/adpcm';

export default defineBlock({
  id: 'adpcm-decoder',
  category: 'diferencial',
  icon: '🎚️',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'adpcm-ima', 'El decodificador ADPCM');
    return {
      outputs: {
        out: makeSignal(
          adpcmDecode(b.bytes, b.bitLength, b.header.numSamples),
          b.header.sampleRate,
        ),
      },
    };
  },
});

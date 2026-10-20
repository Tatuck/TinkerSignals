import { expectCodec } from '@/engine/dsp/bitstream';
import { makeSignal } from '@/engine/dsp/signal';
import type { Law } from '@/engine/dsp/companding';
import { defineBlock } from '@/engine/types';
import { pcmDecode } from '../_shared/pcm';

export default defineBlock({
  id: 'pcm-decoder',
  category: 'digitalizacion',
  family: 'pcm',
  familyRole: 'decoder',
  icon: '🔢',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'pcm', 'El decodificador PCM');
    const h = b.header as typeof b.header & { bits: number; law: Law; mu: number };
    const y = pcmDecode(b.bytes, b.bitLength, h.numSamples, h);
    return { outputs: { out: makeSignal(y, h.sampleRate) } };
  },
});

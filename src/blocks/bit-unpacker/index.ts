import { BitReader } from '@/engine/dsp/bits';
import { uniformValue } from '@/engine/dsp/quantize';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

/** Lee grupos de n bits y los convierte en el nivel de la escalera que representan. */
export default defineBlock({
  id: 'bit-unpacker',
  category: 'piezas',
  family: 'bits',
  familyRole: 'decoder',
  icon: '🔢',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {
    bits: { type: 'number', default: 8, min: 1, max: 16, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const r = new BitReader(b.bytes, b.bitLength);
    const n = b.header.numSamples || Math.floor(b.bitLength / params.bits);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = uniformValue(r.read(params.bits), params.bits, 'midrise');
    return { outputs: { out: makeSignal(y, b.header.sampleRate) } };
  },
});

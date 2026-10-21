import { defineBlock } from '@/engine/types';
import { revealBits, signalToInts } from '../_shared/lsb';

export default defineBlock({
  id: 'lsb-reveal-audio',
  category: 'utilidades',
  family: 'lsb-audio',
  familyRole: 'decoder',
  icon: '🕵️',
  inputs: { in: { type: 'signal' } },
  outputs: { message: { type: 'bitstream' } },
  params: {
    bits: { type: 'number', default: 1, min: 1, max: 8, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const message = revealBits(signalToInts(inputs.in.samples), params.bits);
    return {
      outputs: { message },
      metrics: [{ key: 'recovered', value: message.bitLength, unit: 'bits', highlight: true }],
    };
  },
});

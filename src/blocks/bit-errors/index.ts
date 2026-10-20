import { defineBlock } from '@/engine/types';
import { seededRandom } from '../_shared/random';

export default defineBlock({
  id: 'bit-errors',
  category: 'canal',
  icon: '⚡',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    ber: { type: 'number', default: 0.001, min: 0.00001, max: 0.1, scale: 'log' },
    seed: { type: 'number', default: 1, min: 1, max: 999, step: 1 },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const bytes = b.bytes.slice();
    const rand = seededRandom(params.seed);
    let flipped = 0;
    // Salta directamente al siguiente error (distribución geométrica): rápido aunque haya millones de bits.
    const next = () => Math.floor(Math.log(1 - rand()) / Math.log(1 - params.ber));
    for (let pos = next(); pos < b.bitLength; pos += 1 + next()) {
      bytes[pos >> 3] ^= 0x80 >> (pos & 7);
      flipped++;
    }
    return {
      outputs: { out: { ...b, bytes } },
      metrics: [
        { key: 'flipped', value: flipped, unit: 'bits', highlight: true },
        { key: 'berReal', value: flipped / Math.max(1, b.bitLength), highlight: true },
      ],
    };
  },
});

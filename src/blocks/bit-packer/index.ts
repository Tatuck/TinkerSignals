import { BitWriter } from '@/engine/dsp/bits';
import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { uniformIndex } from '@/engine/dsp/quantize';
import { defineBlock } from '@/engine/types';

/** Convierte cada nivel cuantizado en su número binario de n bits. */
export default defineBlock({
  id: 'bit-packer',
  category: 'piezas',
  family: 'bits',
  familyRole: 'encoder',
  icon: '🔢',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    bits: { type: 'number', default: 8, min: 1, max: 16, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate } = inputs.in;
    const w = new BitWriter();
    for (const v of x) w.write(uniformIndex(v, params.bits, 'midrise'), params.bits);
    return {
      outputs: {
        out: makeBitstream(
          w,
          {
            codec: 'raw',
            sampleRate,
            numSamples: x.length,
            bits: params.bits,
            symbolBits: params.bits,
          },
          referenceBitsFor(x.length),
        ),
      },
      metrics: [{ key: 'bitrate', value: params.bits * sampleRate, unit: 'bps', highlight: true }],
    };
  },
});

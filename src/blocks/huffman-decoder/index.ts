import { expectCodec } from '@/engine/dsp/bitstream';
import { defineBlock, type BitstreamHeader } from '@/engine/types';
import { huffmanDecode } from '../_shared/huffman';

export default defineBlock({
  id: 'huffman-decoder',
  category: 'sin-perdidas',
  icon: '🌳',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'huffman', 'El decodificador Huffman');
    const { bytes, bitLength } = huffmanDecode(b.bytes, b.bitLength).finish();
    return {
      outputs: {
        out: {
          kind: 'bitstream',
          bytes,
          bitLength,
          header: b.header.inner as BitstreamHeader,
          referenceBits: b.referenceBits,
        },
      },
      metrics: [{ key: 'expansion', value: bitLength / b.bitLength, unit: '×' }],
    };
  },
});

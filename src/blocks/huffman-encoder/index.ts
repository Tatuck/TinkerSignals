import { makeBitstream } from '@/engine/dsp/bitstream';
import { defineBlock } from '@/engine/types';
import { huffmanEncode } from '../_shared/huffman';

export default defineBlock({
  id: 'huffman-encoder',
  category: 'sin-perdidas',
  icon: '🌳',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    symbolBits: { type: 'select', default: 'auto', options: ['auto', '4', '8', '12', '16'] },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const fromHeader = Number(b.header.symbolBits);
    const symbolBits =
      params.symbolBits === 'auto' ? (fromHeader >= 1 && fromHeader <= 16 ? fromHeader : 8) : Number(params.symbolBits);
    const { writer, stats } = huffmanEncode(b.bytes, b.bitLength, symbolBits);
    const out = makeBitstream(
      writer,
      {
        codec: 'huffman',
        sampleRate: b.header.sampleRate,
        numSamples: b.header.numSamples,
        inner: b.header,
      },
      b.referenceBits,
    );
    return {
      outputs: { out },
      metrics: [
        { key: 'gain', value: b.bitLength / out.bitLength, unit: '×', highlight: true },
        { key: 'avgLength', value: stats.avgLength, unit: 'bits', highlight: true },
        { key: 'entropy', value: stats.entropy, unit: 'bits' },
        { key: 'symbolBits', value: symbolBits, unit: 'bits' },
        { key: 'distinct', value: stats.distinct },
        { key: 'maxLength', value: stats.maxLength, unit: 'bits' },
        { key: 'compression', value: out.referenceBits / out.bitLength, unit: '×' },
      ],
      plots: [
        {
          kind: 'bars',
          title: 'probabilities',
          values: stats.top.map((t) => t.p),
          labels: stats.top.map((t) => `Símbolo ${t.sym}: p = ${t.p.toFixed(3)}, código ${t.code}`),
        },
      ],
    };
  },
});

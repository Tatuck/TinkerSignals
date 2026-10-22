import { makeBitstream } from '@/engine/dsp/bitstream';
import { num, symbolLabel } from '../_shared/traces';
import { defineBlock } from '@/engine/types';
import { huffmanEncode } from '../_shared/huffman';

export default defineBlock({
  id: 'huffman-encoder',
  category: 'sin-perdidas',
  family: 'huffman',
  familyRole: 'encoder',
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
      params.symbolBits === 'auto'
        ? fromHeader >= 1 && fromHeader <= 16
          ? fromHeader
          : 8
        : Number(params.symbolBits);
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
        { key: 'variance', value: stats.variance, unit: 'bits²' },
        { key: 'compression', value: out.referenceBits / out.bitLength, unit: '×' },
      ],
      plots: [
        {
          kind: 'bars',
          title: 'probabilities',
          values: stats.top.map((t) => t.p),
          labels: stats.top.map((t) => `Símbolo ${t.sym}: p = ${t.p.toFixed(3)}, código ${t.code}`),
        },
        {
          kind: 'table',
          title: 'codes',
          columns: ['Símbolo', 'Veces', '$p_i$', 'Código', '$l_i$'],
          rows: stats.table.map((r) => [
            symbolLabel(r.sym, symbolBits),
            r.count,
            r.p,
            r.code,
            r.len,
          ]),
          notes: [
            `Longitud media: $\\bar L = \\sum p_i l_i =$ **${num(stats.avgLength)}** bits/símbolo. Varianza: $\\sum p_i (l_i - \\bar L)^2 =$ ${num(stats.variance)}.`,
            `Entropía: $H = -\\sum p_i \\log_2 p_i =$ **${num(stats.entropy)}** bits/símbolo; eficiencia $H/\\bar L =$ ${num((100 * stats.entropy) / Math.max(1e-12, stats.avgLength), 1)} %.`,
            `Compresión frente a ${symbolBits} bits fijos: $CR = ${symbolBits}/\\bar L =$ ${num(symbolBits / Math.max(1e-12, stats.avgLength))}; redundancia relativa $R_D = 1 - 1/CR =$ ${num(1 - stats.avgLength / symbolBits)}.`,
            stats.table.length < stats.distinct
              ? `Solo se enseñan los ${stats.table.length} símbolos más frecuentes de ${stats.distinct}.`
              : 'Huffman canónico: las longitudes salen del árbol; los códigos se asignan por longitud y, a igual longitud, por símbolo.',
          ],
        },
      ],
    };
  },
});

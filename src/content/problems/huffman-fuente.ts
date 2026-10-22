import { int, shuffle, tex } from '../problemKit';
import { defineProblem, type Circuit } from '../types';

interface Data {
  /** Veces que aparece cada letra (A, B, C…). */
  counts: number[];
  text: string;
}

const letters = (d: Data) => d.counts.map((_, i) => String.fromCharCode(65 + i));
const total = (d: Data) => d.counts.reduce((a, b) => a + b, 0);
/** Bits por símbolo de un código de longitud fija para este alfabeto. */
const fixedBits = (d: Data) => Math.ceil(Math.log2(d.counts.length));

export default defineProblem<Data>({
  id: 'huffman-fuente',
  title: 'Huffman: longitud media, entropía y compresión',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 50,
  tags: [
    'Huffman',
    'entropía',
    'longitud media',
    'eficiencia',
    'ratio de compresión',
    'redundancia',
  ],
  generate(rand) {
    const m = int(rand, 4, 6);
    const counts = Array.from({ length: m }, () => int(rand, 1, 12)).sort((a, b) => b - a);
    const text = shuffle(
      rand,
      counts.flatMap((c, i) => Array<string>(c).fill(String.fromCharCode(65 + i))),
    ).join('');
    return { counts, text };
  },
  statement: (d) =>
    `Una fuente emite ${d.counts.length} símbolos. En un mensaje de ${total(d)} símbolos aparecen:\n\n${letters(
      d,
    )
      .map((l, i) => `**${l}**: ${d.counts[i]}`)
      .join(
        ' · ',
      )}\n\nConstruye un código de Huffman con esas frecuencias y calcula la entropía, la longitud media, la eficiencia, y la ratio de compresión y la redundancia relativa frente a un código de longitud fija de ${fixedBits(d)} bits.`,
  circuit: (d): Circuit => ({
    nodes: [
      { id: 'src', type: 'text-source', x: 0, y: 40, params: { text: d.text, encoding: 'utf-8' } },
      { id: 'huf', type: 'huffman-encoder', x: 360, y: 40, params: { symbolBits: '8' } },
    ],
    edges: [['src', 'out', 'huf', 'in']],
  }),
  answers: [
    {
      key: 'h',
      label: 'Entropía $H$',
      unit: 'bits/símbolo',
      tolerance: 0.005,
      solve: (_, r) => r.metric('huf', 'entropy'),
    },
    {
      key: 'l',
      label: 'Longitud media $\\bar L$',
      unit: 'bits/símbolo',
      tolerance: 0.005,
      solve: (_, r) => r.metric('huf', 'avgLength'),
    },
    {
      key: 'eff',
      label: 'Eficiencia $H / \\bar L$',
      unit: '%',
      tolerance: 0.2,
      solve: (_, r) => {
        const h = r.metric('huf', 'entropy');
        const l = r.metric('huf', 'avgLength');
        return h !== undefined && l ? (100 * h) / l : undefined;
      },
    },
    {
      key: 'cr',
      label: 'Ratio de compresión $C_R$',
      tolerance: 0.01,
      solve: (d, r) => {
        const l = r.metric('huf', 'avgLength');
        return l ? fixedBits(d) / l : undefined;
      },
    },
    {
      key: 'rd',
      label: 'Redundancia relativa $R_D$',
      unit: '%',
      tolerance: 0.2,
      solve: (d, r) => {
        const l = r.metric('huf', 'avgLength');
        return l ? 100 * (1 - l / fixedBits(d)) : undefined;
      },
    },
  ],
  hints: (d) => [
    `Probabilidades: $p_i = n_i / ${total(d)}$. Entropía: $H = -\\sum p_i \\log_2 p_i$.`,
    'Huffman: junta una y otra vez los dos símbolos menos probables en un nodo con la suma de sus probabilidades; al final, la longitud de cada código es la profundidad de su hoja.',
    `$\\bar L = \\sum p_i\\,l_i$; $C_R = ${fixedBits(d)} / \\bar L$; $R_D = 1 - 1/C_R$.`,
  ],
  explain: (d, r) => {
    const l = r.metric('huf', 'avgLength');
    return `Los códigos pueden salir distintos según cómo se deshagan los empates, pero la longitud media de un código de Huffman es siempre la misma: ${l === undefined ? '' : `$\\bar L = ${tex(l)}$ bits/símbolo, `}nunca menos que la entropía ni más que $H + 1$. Un código fijo necesitaría ${fixedBits(d)} bits por símbolo.`;
  },
  solutionTables: [['huf', 'codes']],
});

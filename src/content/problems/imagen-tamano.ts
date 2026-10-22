import { pick, round, tex } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  w: number;
  h: number;
  levels: number;
  compressedBits: number;
}

const bitsPerPixel = (d: Data) => Math.log2(d.levels);
const rawBits = (d: Data) => d.w * d.h * bitsPerPixel(d);
const ratio = (d: Data) => rawBits(d) / d.compressedBits;

export default defineProblem<Data>({
  id: 'imagen-tamano',
  title: 'Tamaño de una imagen y ratio de compresión',
  topic: 'imagen',
  level: 'basico',
  audience: ['estudiar'],
  order: 50,
  tags: ['imagen', 'tamaño', 'KB', 'niveles de gris', 'ratio de compresión', 'redundancia'],
  generate(rand) {
    const w = pick(rand, [64, 128, 256, 512]);
    const h = pick(rand, [64, 128, 256, 512]);
    const levels = pick(rand, [2, 4, 16, 64, 128, 256]);
    const raw = w * h * Math.log2(levels);
    return { w, h, levels, compressedBits: Math.round(raw * (0.1 + 0.5 * rand())) };
  },
  statement: (d) =>
    `Una imagen de **${d.w} × ${d.h}** píxeles tiene **${d.levels} niveles de gris**.\n\n1. ¿Cuánto ocupa sin comprimir, en KB (1 KB = 1024 bytes)?\n2. Un compresor la deja en **${d.compressedBits.toLocaleString('es-ES')} bits**. ¿Cuál es la ratio de compresión? ¿Y la redundancia relativa de datos?`,
  answers: [
    {
      key: 'kb',
      label: 'Tamaño sin comprimir',
      unit: 'KB',
      tolerance: 0.01,
      solve: (d) => rawBits(d) / 8 / 1024,
    },
    { key: 'cr', label: 'Ratio de compresión $C_R$', tolerance: 0.01, solve: ratio },
    {
      key: 'rd',
      label: 'Redundancia relativa $R_D$',
      unit: '%',
      tolerance: 0.2,
      solve: (d) => 100 * (1 - 1 / ratio(d)),
    },
  ],
  hints: (d) => [
    `Con ${d.levels} niveles cada píxel necesita $\\log_2 ${d.levels} = ${bitsPerPixel(d)}$ bits.`,
    '$C_R = n_1 / n_2$ (bits sin comprimir entre bits comprimidos) y $R_D = 1 - 1/C_R$.',
  ],
  explain: (d) =>
    `$${d.w} \\cdot ${d.h} \\cdot ${bitsPerPixel(d)} = ${rawBits(d)}$ bits $= ${tex(rawBits(d) / 8 / 1024, 2)}$ KB.\n\n$C_R = ${rawBits(d)} / ${d.compressedBits} = ${tex(ratio(d))}$ y $R_D = ${tex(round(100 * (1 - 1 / ratio(d)), 2), 2)}\\ \\%$: esa parte de los datos originales era redundante.`,
});

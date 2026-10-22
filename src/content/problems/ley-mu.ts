import { pick, round, tex } from '../problemKit';
import { defineProblem, type Circuit, type SolveContext } from '../types';

interface Data {
  x: number;
  bits: number;
}

const cell = (col: number) => (_: Data, r: SolveContext) => {
  const v = r.table('enc', 'words')?.rows[0]?.[col];
  return typeof v === 'number' ? v : undefined;
};

export default defineProblem<Data>({
  id: 'ley-mu',
  title: 'Compresión con ley μ',
  topic: 'cuantizacion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 60,
  tags: ['ley mu', 'μ-law', 'compansión', 'G.711', 'no uniforme'],
  generate: (rand) => ({
    x: round(
      (rand() < 0.5 ? -1 : 1) *
        pick(rand, [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8]) *
        (0.8 + 0.4 * rand()),
      3,
    ),
    bits: pick(rand, [6, 8]),
  }),
  statement: (d) =>
    `Una muestra normalizada vale $x = ${tex(d.x)}$. Se comprime con la **ley μ** ($\\mu = 255$):\n\n$$F(x) = \\operatorname{sgn}(x)\\,\\frac{\\ln(1 + \\mu|x|)}{\\ln(1 + \\mu)}$$\n\ny después $F(x)$ se cuantiza de forma uniforme con **${d.bits} bits** en $[-1, 1]$ (el nivel 0 es el más negativo). Al recibirla se expande con la inversa.\n\nCalcula $F(x)$, el código (en decimal) y el valor reconstruido $x_q$.`,
  circuit: (d): Circuit => ({
    nodes: [
      {
        id: 'src',
        type: 'number-list',
        x: 0,
        y: 40,
        params: { values: String(d.x), fullScale: 1 },
      },
      {
        id: 'enc',
        type: 'pcm-encoder',
        x: 360,
        y: 40,
        params: { bits: d.bits, law: 'mu', mu: 255 },
      },
    ],
    edges: [['src', 'out', 'enc', 'in']],
  }),
  answers: [
    { key: 'fx', label: '$F(x)$', tolerance: 0.002, solve: cell(2) },
    { key: 'code', label: 'Código (decimal)', tolerance: 0, solve: cell(3) },
    { key: 'xq', label: 'Valor reconstruido $x_q$', tolerance: 0.002, solve: cell(5) },
  ],
  hints: (d) => [
    `$\\ln(1 + 255) = \\ln 256 \\approx 5{,}545$.`,
    `Con ${d.bits} bits hay $${2 ** d.bits}$ niveles de ancho $\\Delta = 2/${2 ** d.bits}$; el código es $\\lfloor (F(x) + 1)/\\Delta \\rfloor$.`,
    'Para reconstruir: el centro del escalón, $y = -1 + (\\text{código} + 0{,}5)\\,\\Delta$, y después la inversa $x = \\operatorname{sgn}(y)\\,\\dfrac{(1+\\mu)^{|y|} - 1}{\\mu}$.',
  ],
  explain: () =>
    'La ley μ estira los valores pequeños antes de cuantizar: los escalones quedan finos cerca de cero y gruesos en los extremos, así que el error relativo es parecido para muestras grandes y pequeñas. La tabla es la del Codificador PCM del laboratorio.',
  solutionTables: [['enc', 'words']],
});

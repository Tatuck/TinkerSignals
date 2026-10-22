import { asList, binary, pick, round, tex } from '../problemKit';
import { defineProblem, type Circuit, type SolveContext } from '../types';

interface Data {
  /** La señal va de −V a V. */
  V: number;
  bits: number;
  samples: number[];
}

/** Código de la muestra i, leído de la tabla del codificador PCM real. */
const codeOf = (i: number) => ({
  key: `c${i}`,
  label: `Código de la muestra ${i + 1}`,
  kind: 'text' as const,
  solve: (d: Data, r: SolveContext) => {
    const code = r.table('enc', 'words')?.rows[i]?.[2];
    return typeof code === 'number' ? binary(code, d.bits) : undefined;
  },
});

export default defineProblem<Data>({
  id: 'pcm-codigos',
  title: 'Códigos PCM de unas muestras',
  topic: 'cuantizacion',
  level: 'basico',
  audience: ['estudiar'],
  order: 55,
  tags: ['PCM', 'código binario', 'niveles', 'escalón'],
  generate(rand) {
    const V = pick(rand, [4, 5, 8, 10]);
    const bits = pick(rand, [3, 4, 4, 5]);
    const delta = (2 * V) / 2 ** bits;
    const samples: number[] = [];
    while (samples.length < 4) {
      const x = round((rand() * 2 - 1) * 0.95 * V, 1);
      // Lejos de las fronteras entre escalones, para que no haya dudas al redondear.
      const f = ((x + V) / delta) % 1;
      if (f > 0.04 && f < 0.96) samples.push(x);
    }
    return { V, bits, samples };
  },
  statement: (d) =>
    `Una señal analógica entre $-${d.V}$ y $${d.V}$ V se digitaliza con **PCM lineal de ${2 ** d.bits} niveles** (el nivel 0 es el más negativo). ¿Qué código binario sale para cada una de estas muestras?\n\n$${d.samples.map((x) => tex(x)).join('\\quad ')}$ V`,
  circuit: (d): Circuit => ({
    nodes: [
      {
        id: 'src',
        type: 'number-list',
        x: 0,
        y: 40,
        params: { values: asList(d.samples), fullScale: d.V },
      },
      { id: 'enc', type: 'pcm-encoder', x: 360, y: 40, params: { bits: d.bits, law: 'linear' } },
    ],
    edges: [['src', 'out', 'enc', 'in']],
  }),
  answers: [0, 1, 2, 3].map(codeOf),
  hints: (d) => [
    `Escalón: $\\Delta = \\dfrac{2V}{L} = \\dfrac{${2 * d.V}}{${2 ** d.bits}} = ${tex((2 * d.V) / 2 ** d.bits)}$ V.`,
    'Nivel: $\\left\\lfloor \\dfrac{x + V}{\\Delta} \\right\\rfloor$, y después a binario con $\\log_2 L$ bits.',
  ],
  explain: (d) =>
    `Con $L = ${2 ** d.bits}$ niveles hacen falta $\\log_2 L = ${d.bits}$ bits y el escalón es $\\Delta = ${tex((2 * d.V) / 2 ** d.bits)}$ V. Cada muestra cae en el escalón $\\lfloor (x + ${d.V}) / \\Delta \\rfloor$; el primer bit dice el signo (1 = positivo). La tabla la ha calculado el propio Codificador PCM del laboratorio, con las muestras normalizadas por el fondo de escala (${d.V} V).`,
  solutionTables: [['enc', 'words']],
});

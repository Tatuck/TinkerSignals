import { int, pick, round, tex } from '../problemKit';
import { defineProblem, type SolutionTable } from '../types';

interface Data {
  step: number;
  samples: number[];
}

/**
 * Redondeo del enunciado: y = n + f con 0 ≤ f < 1; si f ≤ 0,5 se queda en n,
 * si no, n + 1 (así 2,5 → 2 y −2,5 → −3).
 */
const roundHalfDown = (y: number) => {
  const v = round(y, 9);
  const n = Math.floor(v);
  return v - n <= 0.5 ? n : n + 1;
};

interface Row {
  x: number;
  prev: number;
  e: number;
  code: number;
  eq: number;
  xq: number;
}

/** DPCM con predictor x̂(n) = x_q(n − 1); la primera muestra se predice como 0. */
function trace(d: Data): Row[] {
  let prev = 0;
  return d.samples.map((x) => {
    const e = round(x - prev, 9);
    const code = roundHalfDown(e / d.step);
    const eq = round(code * d.step, 9);
    const xq = round(prev + eq, 9);
    const row = { x, prev, e, code, eq, xq };
    prev = xq;
    return row;
  });
}

export default defineProblem<Data>({
  id: 'dpcm-paso',
  title: 'Traza DPCM con paso fijo',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 50,
  tags: ['DPCM', 'traza', 'predicción', 'tabla', 'cuantización'],
  generate(rand) {
    const step = pick(rand, [0.1, 0.2, 0.25, 0.5]);
    const n = int(rand, 5, 7);
    const samples = Array.from({ length: n }, () => round((rand() * 2 - 1) * 0.9, 2));
    return { step, samples };
  },
  statement: (d) =>
    `Un DPCM predice cada muestra con la anterior **ya reconstruida**: $\\hat x(n) = x_q(n-1)$, con $x_q(-1) = 0$ (la primera muestra se cuantiza igual que las demás).\n\nEl cuantizador usa un paso $\\Delta = ${tex(d.step)}$: el código es $\\operatorname{redondeo}(e/\\Delta)$, donde, si $y = n + f$ con $0 \\le f < 1$, se redondea a $n$ cuando $f \\le 0{,}5$ y a $n + 1$ si no ($2{,}5 \\to 2$, $-2{,}5 \\to -3$). Se descuantiza con $e_q = \\text{código} \\cdot \\Delta$.\n\nMuestras: $${d.samples.map((x) => tex(x, 2)).join(',\\ ')}$\n\nRellena la tabla $x(n)$, $x_q(n-1)$, $e(n)$, $e_q(n)$, $x_q(n)$, $x(n) - x_q(n)$ y responde.`,
  answers: [
    {
      key: 'codes',
      label: 'Códigos enviados (en decimal, separados por comas)',
      kind: 'text',
      solve: (d) =>
        trace(d)
          .map((r) => r.code)
          .join(', '),
    },
    {
      key: 'last',
      label: 'Última muestra reconstruida $x_q$',
      tolerance: 0.001,
      solve: (d) => trace(d).at(-1)!.xq,
    },
    {
      key: 'maxErr',
      label: 'Mayor error $|x(n) - x_q(n)|$',
      tolerance: 0.001,
      solve: (d) => Math.max(...trace(d).map((r) => Math.abs(round(r.x - r.xq, 9)))),
    },
  ],
  hints: (d) => {
    const [r0, r1] = trace(d);
    return [
      `Primera fila: $e(0) = ${tex(r0.x, 2)} - 0 = ${tex(r0.e)}$; código $= \\operatorname{redondeo}(${tex(r0.e)}/${tex(d.step)}) = ${r0.code}$; $x_q(0) = ${tex(r0.xq)}$.`,
      `Segunda fila: se predice con $x_q(0) = ${tex(r1.prev)}$, no con $x(0)$. Así el decodificador, que solo conoce lo reconstruido, hace la misma predicción.`,
    ];
  },
  explain: () =>
    'El predictor usa lo reconstruido (lazo cerrado), así que el error de cuantización no se acumula: en cada muestra el error es como mucho medio paso, salvo cuando la señal salta más de lo que el código puede seguir. El decodificador recibe solo los códigos y repite $x_q(n) = x_q(n-1) + \\text{código}\\cdot\\Delta$.',
  tables: (d): SolutionTable[] => [
    {
      title: 'Traza DPCM',
      columns: [
        '$n$',
        '$x(n)$',
        '$x_q(n-1)$',
        '$e(n)$',
        'Código',
        '$e_q(n)$',
        '$x_q(n)$',
        '$x(n) - x_q(n)$',
      ],
      rows: trace(d).map((r, n) => [n, r.x, r.prev, r.e, r.code, r.eq, r.xq, round(r.x - r.xq, 9)]),
      stepwise: true,
    },
  ],
});

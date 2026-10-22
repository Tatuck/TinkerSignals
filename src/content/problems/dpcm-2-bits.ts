import { binary, int, round, tex } from '../problemKit';
import { defineProblem, type SolutionTable } from '../types';

interface Data {
  samples: number[];
}

/** Cuantizador de 2 bits del enunciado: niveles −4, −1, 1, 4 con fronteras en −3, 0 y 3. */
function quantize(e: number): { code: number; eq: number } {
  if (e >= 3) return { code: 3, eq: 4 };
  if (e >= 0) return { code: 2, eq: 1 };
  if (e >= -3) return { code: 1, eq: -1 };
  return { code: 0, eq: -4 };
}

interface Row {
  x: number;
  prev: number | null;
  e: number | null;
  code: string;
  eq: number | null;
  xq: number;
}

/** La primera muestra va en PCM de 8 bits (x_q(0) = x(0)); el resto, en DPCM de 2 bits. */
function trace(d: Data): Row[] {
  const rows: Row[] = [];
  d.samples.forEach((x, n) => {
    if (n === 0) {
      rows.push({ x, prev: null, e: null, code: binary(x, 8), eq: null, xq: x });
      return;
    }
    const prev = rows[n - 1].xq;
    const e = x - prev;
    const q = quantize(e);
    rows.push({ x, prev, e, code: binary(q.code, 2), eq: q.eq, xq: prev + q.eq });
  });
  return rows;
}

const ratio = (d: Data) => (8 * d.samples.length) / (8 + 2 * (d.samples.length - 1));

export default defineProblem<Data>({
  id: 'dpcm-2-bits',
  title: 'DPCM de 2 bits: tabla y bits enviados',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 55,
  tags: ['DPCM', 'traza', 'bitstream', 'ratio de compresión', 'redundancia'],
  generate(rand) {
    const n = int(rand, 5, 7);
    const samples = [int(rand, 100, 160)];
    while (samples.length < n) samples.push(samples[samples.length - 1] + int(rand, -8, 14));
    return { samples };
  },
  statement: (d) =>
    `Un DPCM predice cada muestra con la anterior reconstruida, $\\hat x(n) = x_q(n-1)$. La **primera muestra** se envía con **8 bits** y $x_q(0) = x(0)$. Las diferencias se cuantizan con **2 bits**:\n\n$e \\ge 3 \\to 4$ (código 11), $\\ 0 \\le e < 3 \\to 1$ (10), $\\ -3 \\le e < 0 \\to -1$ (01), $\\ e < -3 \\to -4$ (00).\n\nMuestras: $${d.samples.join(',\\ ')}$\n\n1. Haz la tabla $x(n)$, $x_q(n-1)$, $e(n)$, $e_q(n)$, $x_q(n)$, $x(n) - x_q(n)$.\n2. Escribe el flujo de bits que se envía.\n3. Calcula la ratio de compresión frente a enviar todas las muestras con 8 bits y la redundancia relativa.`,
  answers: [
    {
      key: 'bits',
      label: 'Flujo de bits',
      kind: 'text',
      solve: (d) =>
        trace(d)
          .map((r) => r.code)
          .join(' '),
    },
    {
      key: 'last',
      label: 'Última muestra reconstruida $x_q$',
      tolerance: 0,
      solve: (d) => trace(d).at(-1)!.xq,
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
  hints: (d) => {
    const r = trace(d)[1];
    return [
      `Primera muestra: ${d.samples[0]} en binario con 8 bits es ${binary(d.samples[0], 8)}.`,
      `Segunda: $e(1) = ${r.x} - ${r.prev} = ${r.e}$ → $e_q = ${r.eq}$ (código ${r.code}), $x_q(1) = ${r.xq}$.`,
      `Sin DPCM: $${d.samples.length} \\cdot 8$ bits. Con DPCM: $8 + ${d.samples.length - 1} \\cdot 2$ bits. $C_R = n_1/n_2$ y $R_D = 1 - 1/C_R$.`,
    ];
  },
  explain: (d) =>
    `$C_R = \\dfrac{${d.samples.length} \\cdot 8}{8 + ${d.samples.length - 1} \\cdot 2} = \\dfrac{${8 * d.samples.length}}{${8 + 2 * (d.samples.length - 1)}} = ${tex(ratio(d))}$ y $R_D = 1 - 1/C_R = ${tex(100 * (1 - 1 / ratio(d)), 1)}\\ \\%$.\n\nCon solo 2 bits el cuantizador no da abasto si la señal sube o baja más de 4 por muestra (**sobrecarga de pendiente**): el error crece hasta que la señal se calma.`,
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
      rows: trace(d).map((r, n) => [
        n,
        r.x,
        r.prev ?? '—',
        r.e ?? '—',
        r.code,
        r.eq ?? '—',
        r.xq,
        round(r.x - r.xq),
      ]),
      stepwise: true,
    },
  ],
});

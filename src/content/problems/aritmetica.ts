import { int, shuffle, tex } from '../problemKit';
import { defineProblem, type Circuit, type SolveContext } from '../types';

interface Data {
  message: string;
}

const counts = (d: Data) => {
  const c = new Map<string, number>();
  for (const ch of [...d.message].sort()) c.set(ch, (c.get(ch) ?? 0) + 1);
  return [...c];
};

const last = (r: SolveContext, col: number) => {
  const v = r.table('ari', 'steps')?.rows.at(-1)?.[col];
  return typeof v === 'number' ? v : undefined;
};

export default defineProblem<Data>({
  id: 'aritmetica',
  title: 'Codificación aritmética de un mensaje corto',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 55,
  tags: ['aritmética', 'intervalo', 'entropía'],
  generate(rand) {
    const alphabet = ['A', 'B', 'C'].slice(0, int(rand, 2, 3));
    const len = int(rand, 4, 5);
    const rest = Array.from(
      { length: len - alphabet.length },
      () => alphabet[int(rand, 0, alphabet.length - 1)],
    );
    return { message: shuffle(rand, [...alphabet, ...rest]).join('') };
  },
  statement: (d) => {
    const n = d.message.length;
    return `Se codifica con **codificación aritmética** el mensaje **${d.message}**. El modelo usa las frecuencias del propio mensaje, ${counts(
      d,
    )
      .map(([s, c]) => `$p(\\text{${s}}) = ${c}/${n}$`)
      .join(
        ', ',
      )}, y reparte $[0, 1)$ en orden alfabético.\n\n¿Cuál es el intervalo $[L, H)$ final? ¿Cuánto mide?`;
  },
  circuit: (d): Circuit => ({
    nodes: [
      {
        id: 'src',
        type: 'text-source',
        x: 0,
        y: 40,
        params: { text: d.message, encoding: 'utf-8' },
      },
      { id: 'ari', type: 'arithmetic-encoder', x: 360, y: 40, params: { symbolBits: '8' } },
    ],
    edges: [['src', 'out', 'ari', 'in']],
  }),
  answers: [
    { key: 'L', label: 'Límite inferior $L$', tolerance: 0.0001, solve: (_, r) => last(r, 3) },
    { key: 'H', label: 'Límite superior $H$', tolerance: 0.0001, solve: (_, r) => last(r, 4) },
    { key: 'w', label: 'Anchura $H - L$', tolerance: 0.00005, solve: (_, r) => last(r, 5) },
  ],
  hints: (d) => {
    let lo = 0;
    const parts = counts(d).map(([s, c]) => {
      const p = c / d.message.length;
      const t = `${s}: $[${tex(lo, 4)}, ${tex(lo + p, 4)})$`;
      lo += p;
      return t;
    });
    return [
      `Trozos iniciales: ${parts.join(', ')}.`,
      'Con cada símbolo: $L \\leftarrow L + (H - L)\\,c_{\\text{inf}}$ y $H \\leftarrow L + (H - L)\\,c_{\\text{sup}}$, usando la $L$ de antes en las dos.',
      'La anchura final es el producto de las probabilidades de todos los símbolos del mensaje.',
    ];
  },
  explain: () =>
    'Cualquier número dentro de $[L, H)$ identifica el mensaje. Hacen falta unos $\\lceil -\\log_2 (H - L) \\rceil$ bits para escribirlo, que es casi la información del mensaje: por eso la aritmética se acerca más a la entropía que Huffman.',
  solutionTables: [
    ['ari', 'model'],
    ['ari', 'steps'],
  ],
});

import { amplitudeBits, category, huffmanCodeOf } from '@/blocks/_shared/jpeg';
import { int } from '../problemKit';
import { defineProblem, type SolutionTable } from '../types';

interface Data {
  dc: number[];
}

/** Diferencia con el bloque anterior (el primero, con 0), categoría y bits de cada DC. */
const rows = (d: Data) =>
  d.dc.map((v, i) => {
    const diff = v - (i ? d.dc[i - 1] : 0);
    const size = category(diff);
    return { v, diff, size, code: huffmanCodeOf('dc', size), amp: amplitudeBits(diff) };
  });

/** Tabla típica de Huffman de la DC de luminancia (anexo K de la norma). */
const dcTable = () =>
  Array.from({ length: 12 }, (_, s) => `${s}: ${huffmanCodeOf('dc', s)}`).join(' · ');

export default defineProblem<Data>({
  id: 'jpeg-dc',
  title: 'JPEG: codificar coeficientes DC',
  topic: 'imagen',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 70,
  tags: ['JPEG', 'DC', 'DPCM', 'categoría', 'Huffman', 'complemento a 1'],
  generate(rand) {
    const first = (rand() < 0.5 ? -1 : 1) * int(rand, 40, 1500);
    const dc = [first];
    while (dc.length < 3) dc.push(dc[dc.length - 1] + int(rand, -40, 40));
    return { dc };
  },
  statement: (d) =>
    `Los coeficientes DC (ya cuantizados) de tres bloques de luminancia seguidos son $${d.dc.join(',\\ ')}$. Es el principio del barrido, así que el DC «anterior» del primero es 0.\n\nCodifícalos como JPEG: cada uno se envía como **diferencia** con el anterior, con el código de Huffman de su **categoría** seguido de los bits de la **amplitud** (los negativos en complemento a 1).\n\nCódigos de categoría (tabla típica de luminancia): ${dcTable()}`,
  answers: [0, 1, 2].map((i) => ({
    key: `dc${i}`,
    label: `Bits del DC ${i + 1}`,
    kind: 'text' as const,
    solve: (d: Data) => {
      const r = rows(d)[i];
      return r.code + r.amp;
    },
  })),
  hints: (d) => {
    const [r0] = rows(d);
    return [
      `Diferencias: $${rows(d)
        .map((r) => r.diff)
        .join(',\\ ')}$.`,
      'Categoría $= \\lceil \\log_2(|v| + 1) \\rceil$: los bits que necesita $|v|$. Por ejemplo, de 4 a 7 es categoría 3.',
      `Amplitud: si $v \\ge 0$, $v$ en binario con «categoría» bits; si es negativo, se invierten los bits de $|v|$. Para ${r0.diff}: categoría ${r0.size} y amplitud ${r0.amp}.`,
    ];
  },
  explain: () =>
    'La DC de bloques vecinos se parece mucho, así que su diferencia es pequeña y cabe en una categoría baja con un código corto. Es un DPCM de un coeficiente por bloque.',
  tables: (d): SolutionTable[] => [
    {
      title: 'Codificación de la DC',
      columns: ['DC', 'Diferencia', 'Categoría', 'Código', 'Amplitud', 'Bits'],
      rows: rows(d).map((r) => [
        r.v,
        r.diff,
        r.size,
        r.code,
        r.amp || '—',
        r.code.length + r.amp.length,
      ]),
      stepwise: true,
    },
  ],
});

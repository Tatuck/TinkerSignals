import { amplitudeBits, category, huffmanCodeOf } from '@/blocks/_shared/jpeg';
import { int, pick } from '../problemKit';
import { defineProblem, type SolutionTable } from '../types';

interface Data {
  /** Los 63 coeficientes AC en orden zigzag. */
  ac: number[];
}

interface Sym {
  what: string;
  pair: string;
  value: number | null;
  code: string;
  amp: string;
}

/** Pares (ceros delante, categoría) + amplitud, con ZRL para 16 ceros y EOB al final. */
function symbols(d: Data): Sym[] {
  const out: Sym[] = [];
  let last = 62;
  while (last >= 0 && d.ac[last] === 0) last--;
  let run = 0;
  for (let k = 0; k <= last; k++) {
    const v = d.ac[k];
    if (v === 0) {
      run++;
      continue;
    }
    while (run > 15) {
      out.push({ what: 'ZRL', pair: 'ZRL', value: null, code: huffmanCodeOf('ac', 0xf0), amp: '' });
      run -= 16;
    }
    const s = category(v);
    out.push({
      what: `AC ${k + 1}`,
      pair: `${run}/${s}`,
      value: v,
      code: huffmanCodeOf('ac', (run << 4) | s),
      amp: amplitudeBits(v),
    });
    run = 0;
  }
  if (last < 62)
    out.push({ what: 'EOB', pair: 'EOB', value: null, code: huffmanCodeOf('ac', 0), amp: '' });
  return out;
}

/** Los AC como en un enunciado: los grupos de ceros largos, abreviados. */
function written(ac: number[]): string {
  let last = 62;
  while (last >= 0 && ac[last] === 0) last--;
  const parts: string[] = [];
  let zeros = 0;
  const flush = () => {
    if (zeros >= 4) parts.push(`(${zeros} ceros)`);
    else for (let i = 0; i < zeros; i++) parts.push('0');
    zeros = 0;
  };
  for (let k = 0; k <= last; k++) {
    if (ac[k] === 0) zeros++;
    else {
      flush();
      parts.push(String(ac[k]).replace('-', '−'));
    }
  }
  return `${parts.join(' ')} … (el resto, ceros)`;
}

export default defineProblem<Data>({
  id: 'jpeg-ac',
  title: 'JPEG: codificar coeficientes AC',
  topic: 'imagen',
  level: 'avanzado',
  audience: ['estudiar'],
  order: 75,
  tags: ['JPEG', 'AC', 'zigzag', 'run-length', 'EOB', 'ZRL', 'categoría'],
  generate(rand) {
    const ac = new Array<number>(63).fill(0);
    let k = int(rand, 0, 1);
    const n = int(rand, 3, 5);
    for (let i = 0; i < n && k < 50; i++) {
      ac[k] = (rand() < 0.5 ? -1 : 1) * pick(rand, [1, 1, 2, 3, 5, 8, 12, 25]);
      k += 1 + (rand() < 0.2 ? int(rand, 14, 20) : int(rand, 0, 4));
    }
    return { ac };
  },
  statement: (d) =>
    `Tras cuantizar un bloque y recorrerlo en zigzag, los coeficientes **AC** son:\n\n$\\quad$ ${written(d.ac)}\n\nCodifícalos como JPEG: cada coeficiente no nulo se envía como el par **(ceros delante / categoría)** más su **amplitud**; una racha de 16 ceros se envía como **ZRL** y el final del bloque como **EOB**.\n\nEscribe los pares en orden (por ejemplo «0/1 2/1 ZRL 3/2 EOB»), cuántos símbolos de Huffman se envían y cuántos bits suman las amplitudes.`,
  answers: [
    {
      key: 'pairs',
      label: 'Pares en orden',
      kind: 'text',
      solve: (d) =>
        symbols(d)
          .map((s) => s.pair)
          .join(' '),
    },
    { key: 'count', label: 'Símbolos de Huffman', tolerance: 0, solve: (d) => symbols(d).length },
    {
      key: 'amp',
      label: 'Bits de amplitud',
      tolerance: 0,
      solve: (d) => symbols(d).reduce((n, s) => n + s.amp.length, 0),
    },
  ],
  hints: () => [
    'Cuenta los ceros que hay justo delante de cada coeficiente no nulo; la categoría es el número de bits de su valor absoluto (1 → 1, 2–3 → 2, 4–7 → 3, 8–15 → 4…).',
    'Si delante hay más de 15 ceros, se envía un ZRL (16 ceros) y se siguen contando los que quedan.',
    'Después del último no nulo va un EOB (salvo que el bloque acabe justo en el coeficiente 63). Los bits de amplitud de cada coeficiente son tantos como su categoría.',
  ],
  explain: (d) => {
    const bits = symbols(d).reduce((n, s) => n + s.code.length + s.amp.length, 0);
    return `Con la tabla típica de Huffman de luminancia, estos AC ocupan **${bits} bits**. Los ceros no cuestan casi nada: van dentro del par, y el EOB se come todos los del final de una vez.`;
  },
  tables: (d): SolutionTable[] => [
    {
      title: 'Codificación de los AC',
      columns: ['Qué', 'Valor', 'Par', 'Código (tabla típica)', 'Amplitud', 'Bits'],
      rows: symbols(d).map((s) => [
        s.what,
        s.value ?? '—',
        s.pair,
        s.code,
        s.amp || '—',
        s.code.length + s.amp.length,
      ]),
      stepwise: true,
    },
  ],
});

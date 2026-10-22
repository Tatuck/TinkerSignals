import { int, pick } from '../problemKit';
import { defineProblem, type Circuit } from '../types';

interface Data {
  message: string;
}

export default defineProblem<Data>({
  id: 'lzw',
  title: 'LZW: códigos enviados y diccionario',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 60,
  tags: ['LZW', 'Lempel-Ziv', 'diccionario'],
  generate(rand) {
    const alphabet = pick(rand, ['AB', 'AB', 'ABC']);
    const len = int(rand, 9, 13);
    // Con repeticiones, para que el diccionario sirva de algo.
    let message = '';
    while (message.length < len)
      message +=
        rand() < 0.4 && message.length > 2
          ? message.slice(-int(rand, 2, 3))
          : alphabet[int(rand, 0, alphabet.length - 1)];
    return { message: message.slice(0, len) };
  },
  statement: (d) =>
    `Comprime con **LZW** el mensaje **${d.message}**. El diccionario empieza con los 256 bytes (A = 65, B = 66, C = 67) y las entradas nuevas se numeran desde 256.\n\n¿Qué códigos se envían? ¿Cuántos son?`,
  circuit: (d): Circuit => ({
    nodes: [
      {
        id: 'src',
        type: 'text-source',
        x: 0,
        y: 40,
        params: { text: d.message, encoding: 'utf-8' },
      },
      { id: 'lzw', type: 'lzw-encoder', x: 360, y: 40, params: { symbolBits: '8' } },
    ],
    edges: [['src', 'out', 'lzw', 'in']],
  }),
  answers: [
    {
      key: 'codes',
      label: 'Códigos enviados (separados por comas)',
      kind: 'text',
      solve: (_, r) =>
        r
          .table('lzw', 'dictionary')
          ?.rows.map((row) => row[3])
          .join(', '),
    },
    {
      key: 'count',
      label: 'Número de códigos',
      tolerance: 0,
      solve: (_, r) => r.table('lzw', 'dictionary')?.rows.length,
    },
  ],
  hints: () => [
    'Ve leyendo: mientras $w + c$ esté en el diccionario, alarga $w$. Cuando no esté, envía el código de $w$, añade $w + c$ como entrada nueva y empieza otra vez desde $c$.',
    'Al acabar el mensaje, envía el código de lo que quede en $w$.',
  ],
  explain: (d, r) => {
    const n = r.table('lzw', 'dictionary')?.rows.length ?? 0;
    return `Se envían ${n} códigos para ${d.message.length} símbolos. En un mensaje tan corto apenas se gana nada (cada código ocupa 8 o 9 bits, tanto o más que un byte), pero en textos largos las entradas del diccionario van siendo cada vez más largas y un solo código sustituye a muchos símbolos.`;
  },
  solutionTables: [['lzw', 'dictionary']],
});

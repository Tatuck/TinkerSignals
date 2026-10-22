import { defineExample } from '../types';

export default defineExample({
  id: 'huffman',
  title: 'DPCM + Huffman',
  description:
    'El error de predicción se concentra en pocos valores: Huffman lo aprovecha sin perder nada.',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 20,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 80 },
    { id: 'enc', type: 'dpcm-encoder', x: 320, y: 40, params: { bits: 6, order: 2 } },
    { id: 'h', type: 'huffman-encoder', x: 640, y: 20 },
    { id: 'hd', type: 'huffman-decoder', x: 960, y: 60 },
    { id: 'dec', type: 'dpcm-decoder', x: 1260, y: 80 },
    { id: 'out', type: 'output', x: 1560, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'enc', 'in'],
    ['enc', 'out', 'h', 'in'],
    ['h', 'out', 'hd', 'in'],
    ['hd', 'out', 'dec', 'in'],
    ['dec', 'out', 'out', 'in'],
    ['gen', 'out', 'out', 'reference'],
  ],
});

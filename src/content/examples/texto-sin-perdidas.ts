import { defineExample } from '../types';

export default defineExample({
  id: 'texto-sin-perdidas',
  title: 'Tres compresores con el mismo texto',
  description:
    'Huffman, aritmética y LZW comprimen la misma frase. Cada uno enseña su traza paso a paso.',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar', 'probar'],
  order: 25,
  tags: ['Huffman', 'aritmética', 'LZW', 'comparar'],
  nodes: [
    {
      id: 'src',
      type: 'text-source',
      x: 0,
      y: 220,
      params: { text: 'el perro de san roque no tiene rabo porque ramón ramírez se lo ha robado' },
    },
    { id: 'huf', type: 'huffman-encoder', x: 380, y: 0 },
    { id: 'ari', type: 'arithmetic-encoder', x: 380, y: 220 },
    { id: 'lzw', type: 'lzw-encoder', x: 380, y: 440 },
  ],
  edges: [
    ['src', 'out', 'huf', 'in'],
    ['src', 'out', 'ari', 'in'],
    ['src', 'out', 'lzw', 'in'],
  ],
});

import { defineExample } from '../types';

export default defineExample({
  id: 'sin-perdidas',
  title: 'Huffman, aritmética, LZW y RLE',
  description: 'Los mismos bits de un DPCM, comprimidos sin pérdidas de cuatro formas.',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar', 'probar'],
  order: 10,
  nodes: [
    { id: 'lib', type: 'sound-library', x: 0, y: 260, params: { sound: 'voz-femenina' } },
    { id: 'enc', type: 'dpcm-encoder', x: 320, y: 240, params: { bits: 5, order: 4 } },
    { id: 'h', type: 'huffman-encoder', x: 680, y: 0 },
    { id: 'a', type: 'arithmetic-encoder', x: 680, y: 220 },
    { id: 'l', type: 'lzw-encoder', x: 680, y: 440 },
    { id: 'r', type: 'rle-encoder', x: 680, y: 660 },
  ],
  edges: [
    ['lib', 'out', 'enc', 'in'],
    ['enc', 'out', 'h', 'in'],
    ['enc', 'out', 'a', 'in'],
    ['enc', 'out', 'l', 'in'],
    ['enc', 'out', 'r', 'in'],
  ],
});

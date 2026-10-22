import { defineExample } from '../types';

export default defineExample({
  id: 'huffman-imagen',
  title: 'Huffman de una imagen pequeña',
  description: 'Una matriz 8×8 de 8 niveles a 3 bits por píxel, comprimida con Huffman y RLE.',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 30,
  nodes: [
    { id: 'src', type: 'image-source', x: 0, y: 140, params: { image: 'ejercicio-7' } },
    { id: 'pcm', type: 'image-pcm-encoder', x: 320, y: 140, params: { bits: 3 } },
    { id: 'h', type: 'huffman-encoder', x: 680, y: 0 },
    { id: 'hd', type: 'huffman-decoder', x: 1000, y: 0 },
    { id: 'dec', type: 'image-pcm-decoder', x: 1320, y: 0 },
    { id: 'r', type: 'rle-encoder', x: 680, y: 300 },
  ],
  edges: [
    ['src', 'out', 'pcm', 'in'],
    ['pcm', 'out', 'h', 'in'],
    ['h', 'out', 'hd', 'in'],
    ['hd', 'out', 'dec', 'in'],
    ['pcm', 'out', 'r', 'in'],
  ],
});

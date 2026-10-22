import { defineExample } from '../types';

export default defineExample({
  id: 'jpeg-bloque',
  title: 'JPEG: de un bloque a los bits',
  description:
    'Un JPEG completo. En el codificador eliges un bloque 8 × 8 y ves sus píxeles, su DCT, la cuantización y los bits.',
  topic: 'imagen',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 35,
  tags: ['JPEG', 'DC', 'AC', 'zigzag', 'bloque'],
  nodes: [
    { id: 'src', type: 'image-source', x: 0, y: 40, params: { image: 'paisaje', size: '128' } },
    { id: 'enc', type: 'jpeg-encoder', x: 340, y: 20, params: { quality: 50 } },
    { id: 'dec', type: 'jpeg-decoder', x: 680, y: 40 },
    { id: 'cmp', type: 'image-comparator', x: 1000, y: 20 },
  ],
  edges: [
    ['src', 'out', 'enc', 'in'],
    ['enc', 'out', 'dec', 'in'],
    ['dec', 'out', 'cmp', 'test'],
    ['src', 'out', 'cmp', 'reference'],
  ],
});

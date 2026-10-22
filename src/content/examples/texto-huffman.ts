import { defineExample } from '../types';

export default defineExample({
  id: 'texto-huffman',
  title: 'Huffman con un texto',
  description:
    'Una frase pasa por un código de Huffman y vuelve intacta. Mira la tabla de códigos y la entropía.',
  topic: 'sin-perdidas',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 15,
  tags: ['Huffman', 'entropía', 'texto'],
  nodes: [
    {
      id: 'src',
      type: 'text-source',
      x: 0,
      y: 40,
      params: { text: 'tres tristes tigres tragaban trigo en un trigal' },
    },
    { id: 'huf', type: 'huffman-encoder', x: 340, y: 20 },
    { id: 'hd', type: 'huffman-decoder', x: 680, y: 40 },
    { id: 'view', type: 'text-view', x: 1000, y: 40 },
  ],
  edges: [
    ['src', 'out', 'huf', 'in'],
    ['huf', 'out', 'hd', 'in'],
    ['hd', 'out', 'view', 'in'],
  ],
});

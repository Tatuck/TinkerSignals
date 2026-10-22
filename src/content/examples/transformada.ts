import { defineExample } from '../types';

export default defineExample({
  id: 'transformada',
  title: 'Transformada: compresión frente a retardo',
  description: 'Bloques grandes comprimen mejor, pero hay que esperar a llenarlos.',
  topic: 'perceptual',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 10,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 80 },
    {
      id: 'tc',
      type: 'transform-codec',
      x: 320,
      y: 20,
      params: { blockSize: '256', keep: 20, bits: 6 },
    },
    { id: 'out', type: 'output', x: 680, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'tc', 'in'],
    ['tc', 'out', 'out', 'in'],
    ['gen', 'out', 'out', 'reference'],
  ],
});

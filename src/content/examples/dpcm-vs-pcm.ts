import { defineExample } from '../types';

export default defineExample({
  id: 'dpcm-vs-pcm',
  title: 'DPCM frente a PCM con 4 bits',
  description: 'Mismos bits por muestra; la predicción marca la diferencia.',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 10,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 180 },
    { id: 'denc', type: 'dpcm-encoder', x: 320, y: 0, params: { bits: 4, order: 4 } },
    { id: 'ddec', type: 'dpcm-decoder', x: 640, y: 30 },
    { id: 'penc', type: 'pcm-encoder', x: 320, y: 360, params: { bits: 4, law: 'linear' } },
    { id: 'pdec', type: 'pcm-decoder', x: 640, y: 390 },
    { id: 'c1', type: 'comparator', x: 960, y: 0 },
    { id: 'c2', type: 'comparator', x: 960, y: 360 },
  ],
  edges: [
    ['gen', 'out', 'denc', 'in'],
    ['denc', 'out', 'ddec', 'in'],
    ['gen', 'out', 'penc', 'in'],
    ['penc', 'out', 'pdec', 'in'],
    ['gen', 'out', 'c1', 'reference'],
    ['ddec', 'out', 'c1', 'test'],
    ['gen', 'out', 'c2', 'reference'],
    ['pdec', 'out', 'c2', 'test'],
  ],
});

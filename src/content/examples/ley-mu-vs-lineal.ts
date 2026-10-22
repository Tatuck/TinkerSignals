import { defineExample } from '../types';

export default defineExample({
  id: 'ley-mu-vs-lineal',
  title: 'Ley μ frente a PCM lineal',
  description:
    'Una vocal flojita con dos PCM de 6 bits: arriba lineal, abajo con ley μ. Mismos bits, distinta SNR.',
  topic: 'cuantizacion',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 40,
  tags: ['ley mu', 'compansión', 'no uniforme', 'G.711'],
  nodes: [
    {
      id: 'gen',
      type: 'generator',
      x: 0,
      y: 220,
      params: { sampleRate: '8000', amplitude: 0.1 },
    },
    { id: 'lin', type: 'pcm-encoder', x: 340, y: 0, params: { bits: 6, law: 'linear' } },
    { id: 'dlin', type: 'pcm-decoder', x: 680, y: 30 },
    { id: 'c1', type: 'comparator', x: 1000, y: 0 },
    { id: 'mu', type: 'pcm-encoder', x: 340, y: 420, params: { bits: 6, law: 'mu' } },
    { id: 'dmu', type: 'pcm-decoder', x: 680, y: 450 },
    { id: 'c2', type: 'comparator', x: 1000, y: 420 },
  ],
  edges: [
    ['gen', 'out', 'lin', 'in'],
    ['lin', 'out', 'dlin', 'in'],
    ['gen', 'out', 'c1', 'reference'],
    ['dlin', 'out', 'c1', 'test'],
    ['gen', 'out', 'mu', 'in'],
    ['mu', 'out', 'dmu', 'in'],
    ['gen', 'out', 'c2', 'reference'],
    ['dmu', 'out', 'c2', 'test'],
  ],
});

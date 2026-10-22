import { defineExample } from '../types';

export default defineExample({
  id: 'tu-voz-celp',
  title: 'Tu voz por CELP a 8 kHz',
  description: 'Graba tu voz, pásala a 8 kHz y codifícala con CELP.',
  topic: 'voz',
  level: 'intermedio',
  audience: ['curiosear'],
  order: 30,
  nodes: [
    { id: 'mic', type: 'microphone', x: 0, y: 80 },
    { id: 'rs', type: 'resampler', x: 320, y: 60, params: { sampleRate: '8000' } },
    { id: 'enc', type: 'celp-encoder', x: 640, y: 20 },
    { id: 'dec', type: 'celp-decoder', x: 980, y: 60 },
    { id: 'out', type: 'output', x: 1300, y: 40 },
  ],
  edges: [
    ['mic', 'out', 'rs', 'in'],
    ['rs', 'out', 'enc', 'in'],
    ['enc', 'out', 'dec', 'in'],
    ['dec', 'out', 'out', 'in'],
    ['rs', 'out', 'out', 'reference'],
  ],
});

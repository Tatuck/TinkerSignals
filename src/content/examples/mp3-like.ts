import { defineExample } from '../types';

export default defineExample({
  id: 'mp3-like',
  title: 'Codificación perceptual (MPEG-1)',
  description: 'Música a 128 kbps: el ruido se esconde bajo el umbral de enmascaramiento.',
  topic: 'perceptual',
  level: 'avanzado',
  audience: ['estudiar', 'probar'],
  order: 20,
  nodes: [
    { id: 'lib', type: 'sound-library', x: 0, y: 100, params: { sound: 'cuarteto-haydn' } },
    { id: 'enc', type: 'mpeg1-encoder', x: 320, y: 20, params: { bitrate: '128' } },
    { id: 'dec', type: 'mpeg1-decoder', x: 680, y: 60 },
    { id: 'cmp', type: 'comparator', x: 1000, y: 0 },
    { id: 'out', type: 'output', x: 1000, y: 340 },
  ],
  edges: [
    ['lib', 'out', 'enc', 'in'],
    ['enc', 'out', 'dec', 'in'],
    ['lib', 'out', 'cmp', 'reference'],
    ['dec', 'out', 'cmp', 'test'],
    ['dec', 'out', 'out', 'in'],
    ['lib', 'out', 'out', 'reference'],
  ],
});

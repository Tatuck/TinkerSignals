import { defineExample } from '../types';

export default defineExample({
  id: 'banda-ancha',
  title: 'Voz HD: banda ancha frente a telefónica',
  description: 'Los mismos 64 kbps: G.711 a 8 kHz o subbandas a 16 kHz.',
  topic: 'perceptual',
  level: 'intermedio',
  audience: ['curiosear', 'probar'],
  order: 30,
  nodes: [
    { id: 'lib', type: 'sound-library', x: 0, y: 200, params: { sound: 'voz-masculina' } },
    { id: 'rs8', type: 'resampler', x: 320, y: 0, params: { sampleRate: '8000' } },
    { id: 'pcm', type: 'pcm-encoder', x: 640, y: 0, params: { bits: 8, law: 'mu' } },
    { id: 'pdec', type: 'pcm-decoder', x: 960, y: 20 },
    { id: 'o1', type: 'output', x: 1260, y: 0 },
    { id: 'sb', type: 'subband-encoder', x: 640, y: 400 },
    { id: 'sdec', type: 'subband-decoder', x: 960, y: 420 },
    { id: 'o2', type: 'output', x: 1260, y: 400 },
  ],
  edges: [
    ['lib', 'out', 'rs8', 'in'],
    ['rs8', 'out', 'pcm', 'in'],
    ['pcm', 'out', 'pdec', 'in'],
    ['pdec', 'out', 'o1', 'in'],
    ['lib', 'out', 'sb', 'in'],
    ['sb', 'out', 'sdec', 'in'],
    ['sdec', 'out', 'o2', 'in'],
    ['lib', 'out', 'o2', 'reference'],
  ],
});

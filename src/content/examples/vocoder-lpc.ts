import { defineExample } from '../types';

export default defineExample({
  id: 'vocoder-lpc',
  title: 'Vocoder LPC: voz a 3 kbps',
  description: 'Análisis de voz y vocoder LPC: voz inteligible a unos 3 kbps.',
  topic: 'voz',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 10,
  nodes: [
    {
      id: 'gen',
      type: 'generator',
      x: 0,
      y: 120,
      params: { sampleRate: '8000', frequency: 120 },
    },
    { id: 'va', type: 'voice-analysis', x: 320, y: 100 },
    { id: 'enc', type: 'lpc-encoder', x: 640, y: 40 },
    { id: 'dec', type: 'lpc-decoder', x: 960, y: 80 },
    { id: 'out', type: 'output', x: 1280, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'va', 'in'],
    ['va', 'out', 'enc', 'in'],
    ['enc', 'out', 'dec', 'in'],
    ['dec', 'out', 'out', 'in'],
    ['gen', 'out', 'out', 'reference'],
  ],
});

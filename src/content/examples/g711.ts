import { defineExample } from '../types';

export default defineExample({
  id: 'g711',
  title: 'G.711: PCM ley μ a 8 kHz',
  description: 'El códec de la telefonía clásica: 8 kHz × 8 bits = 64 kbps.',
  topic: 'cuantizacion',
  level: 'intermedio',
  audience: ['estudiar', 'probar'],
  order: 30,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 80, params: { sampleRate: '16000' } },
    { id: 'rs', type: 'resampler', x: 320, y: 60, params: { sampleRate: '8000' } },
    { id: 'enc', type: 'pcm-encoder', x: 640, y: 40, params: { bits: 8, law: 'mu' } },
    { id: 'dec', type: 'pcm-decoder', x: 960, y: 80 },
    { id: 'out', type: 'output', x: 1260, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'rs', 'in'],
    ['rs', 'out', 'enc', 'in'],
    ['enc', 'out', 'dec', 'in'],
    ['dec', 'out', 'out', 'in'],
    ['rs', 'out', 'out', 'reference'],
  ],
});

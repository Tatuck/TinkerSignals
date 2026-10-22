import { defineExample } from '../types';

export default defineExample({
  id: 'aliasing',
  title: 'Aliasing al remuestrear',
  description: 'Un barrido bajado a 4 kHz con y sin filtro antialiasing.',
  topic: 'muestreo',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  nodes: [
    {
      id: 'gen',
      type: 'generator',
      x: 0,
      y: 140,
      params: { waveform: 'chirp', frequency: 100, duration: 4, amplitude: 0.5 },
    },
    {
      id: 'aa',
      type: 'resampler',
      x: 340,
      y: 0,
      params: { sampleRate: '4000', antialias: true },
    },
    {
      id: 'noaa',
      type: 'resampler',
      x: 340,
      y: 300,
      params: { sampleRate: '4000', antialias: false },
    },
    { id: 'o1', type: 'output', x: 700, y: 0 },
    { id: 'o2', type: 'output', x: 700, y: 300 },
  ],
  edges: [
    ['gen', 'out', 'aa', 'in'],
    ['gen', 'out', 'noaa', 'in'],
    ['aa', 'out', 'o1', 'in'],
    ['noaa', 'out', 'o2', 'in'],
  ],
});

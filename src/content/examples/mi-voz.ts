import { defineExample } from '../types';

export default defineExample({
  id: 'mi-voz',
  title: 'Tu voz con pocos bits',
  description: 'Graba tu voz y escúchala con 3 bits por muestra frente al original.',
  topic: 'cuantizacion',
  level: 'basico',
  audience: ['curiosear'],
  order: 20,
  nodes: [
    { id: 'mic', type: 'microphone', x: 0, y: 80 },
    { id: 'q', type: 'quantizer-uniform', x: 340, y: 0, params: { bits: 3, mode: 'midtread' } },
    { id: 'out', type: 'output', x: 700, y: 60 },
  ],
  edges: [
    ['mic', 'out', 'q', 'in'],
    ['q', 'out', 'out', 'in'],
    ['mic', 'out', 'out', 'reference'],
  ],
});

import { defineExample } from '../types';

export default defineExample({
  id: 'adpcm-canal',
  title: 'ADPCM por un canal con errores',
  description: '32 kbps a 8 kHz y cómo se recupera de los bits erróneos.',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar', 'probar'],
  order: 20,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 80, params: { sampleRate: '8000', frequency: 180 } },
    { id: 'enc', type: 'adpcm-encoder', x: 320, y: 40 },
    { id: 'ch', type: 'bit-errors', x: 640, y: 60, params: { ber: 0.001 } },
    { id: 'dec', type: 'adpcm-decoder', x: 960, y: 80 },
    { id: 'out', type: 'output', x: 1260, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'enc', 'in'],
    ['enc', 'out', 'ch', 'in'],
    ['ch', 'out', 'dec', 'in'],
    ['dec', 'out', 'out', 'in'],
    ['gen', 'out', 'out', 'reference'],
  ],
});

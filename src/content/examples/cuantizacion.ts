import { defineExample } from '../types';

export default defineExample({
  id: 'cuantizacion',
  title: 'Cuantización uniforme',
  description: 'Una vocal sintética cuantizada a 4 bits. Mueve los bits y escucha el ruido.',
  topic: 'cuantizacion',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  nodes: [
    { id: 'gen', type: 'generator', x: 0, y: 80 },
    { id: 'q', type: 'quantizer-uniform', x: 340, y: 0, params: { bits: 4 } },
    { id: 'out', type: 'output', x: 700, y: 60 },
  ],
  edges: [
    ['gen', 'out', 'q', 'in'],
    ['q', 'out', 'out', 'in'],
    ['gen', 'out', 'out', 'reference'],
  ],
});

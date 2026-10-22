import { defineExample } from '../types';

export default defineExample({
  id: 'imagen-en-imagen',
  title: 'Una imagen dentro de otra',
  description:
    'La placa zonal a 2 bits por píxel escondida en el bit más bajo del paisaje, y recuperado.',
  topic: 'esteganografia',
  level: 'intermedio',
  audience: ['curiosear'],
  order: 20,
  nodes: [
    { id: 'cover', type: 'image-source', x: 0, y: 0, params: { image: 'paisaje', size: '256' } },
    {
      id: 'secret',
      type: 'image-source',
      x: 0,
      y: 320,
      params: { image: 'zona', size: '128', color: false },
    },
    { id: 'pcm', type: 'image-pcm-encoder', x: 320, y: 320, params: { bits: 2 } },
    { id: 'hide', type: 'lsb-hide-image', x: 680, y: 120 },
    { id: 'show', type: 'lsb-reveal-image', x: 1000, y: 120 },
    { id: 'dec', type: 'image-pcm-decoder', x: 1320, y: 140 },
  ],
  edges: [
    ['cover', 'out', 'hide', 'cover'],
    ['secret', 'out', 'pcm', 'in'],
    ['pcm', 'out', 'hide', 'message'],
    ['hide', 'out', 'show', 'in'],
    ['show', 'message', 'dec', 'in'],
  ],
});

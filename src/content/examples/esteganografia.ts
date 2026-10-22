import { defineExample } from '../types';

export default defineExample({
  id: 'esteganografia',
  title: 'Un mensaje escondido en una foto',
  description:
    'Un texto en los bits bajos de los píxeles: la imagen no cambia a la vista, pero el mensaje está ahí.',
  topic: 'esteganografia',
  level: 'basico',
  audience: ['curiosear'],
  order: 10,
  nodes: [
    { id: 'img', type: 'image-source', x: 0, y: 0, params: { image: 'paisaje', size: '256' } },
    { id: 'txt', type: 'text-source', x: 0, y: 320 },
    { id: 'hide', type: 'lsb-hide-image', x: 340, y: 120 },
    { id: 'cmp', type: 'image-comparator', x: 700, y: -100 },
    { id: 'show', type: 'lsb-reveal-image', x: 700, y: 260 },
    { id: 'view', type: 'text-view', x: 1040, y: 280 },
  ],
  edges: [
    ['img', 'out', 'hide', 'cover'],
    ['txt', 'out', 'hide', 'message'],
    ['img', 'out', 'cmp', 'reference'],
    ['hide', 'out', 'cmp', 'test'],
    ['hide', 'out', 'show', 'in'],
    ['show', 'message', 'view', 'in'],
  ],
});

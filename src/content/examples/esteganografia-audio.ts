import { defineExample } from '../types';

export default defineExample({
  id: 'esteganografia-audio',
  title: 'Un mensaje escondido en la voz',
  description: 'Un texto en el bit más bajo de cada muestra de una grabación: no se oye.',
  topic: 'esteganografia',
  level: 'basico',
  audience: ['curiosear'],
  order: 30,
  nodes: [
    { id: 'lib', type: 'sound-library', x: 0, y: 0, params: { sound: 'voz-femenina' } },
    { id: 'txt', type: 'text-source', x: 0, y: 300 },
    { id: 'hide', type: 'lsb-hide-audio', x: 340, y: 120 },
    { id: 'out', type: 'output', x: 700, y: -60 },
    { id: 'show', type: 'lsb-reveal-audio', x: 700, y: 260 },
    { id: 'view', type: 'text-view', x: 1040, y: 280 },
  ],
  edges: [
    ['lib', 'out', 'hide', 'cover'],
    ['txt', 'out', 'hide', 'message'],
    ['hide', 'out', 'out', 'in'],
    ['hide', 'out', 'show', 'in'],
    ['show', 'message', 'view', 'in'],
  ],
});

import { defineExample } from '../types';

export default defineExample({
  id: 'jpeg-paso-a-paso',
  title: 'JPEG paso a paso',
  description:
    'Color a YCbCr, submuestreo, DCT 8×8 y cuantización con piezas sueltas, y el camino de vuelta.',
  topic: 'imagen',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 10,
  nodes: [
    { id: 'src', type: 'image-source', x: 0, y: 200, params: { image: 'paisaje' } },
    { id: 'ycc', type: 'color-space', x: 320, y: 200, params: { to: 'ycbcr' } },
    { id: 'sub', type: 'chroma-subsampling', x: 640, y: 200 },
    { id: 'dct', type: 'block-dct-2d', x: 960, y: 200 },
    { id: 'q', type: 'dct-quantizer', x: 1280, y: 200, params: { quality: 30 } },
    { id: 'idct', type: 'block-idct-2d', x: 1600, y: 200 },
    { id: 'up', type: 'chroma-upsampling', x: 1920, y: 200 },
    { id: 'rgb', type: 'color-space', x: 2240, y: 200, params: { to: 'rgb' } },
    { id: 'cmp', type: 'image-comparator', x: 2560, y: 160 },
  ],
  edges: [
    ['src', 'out', 'ycc', 'in'],
    ['ycc', 'out', 'sub', 'in'],
    ['sub', 'out', 'dct', 'in'],
    ['dct', 'out', 'q', 'in'],
    ['q', 'out', 'idct', 'in'],
    ['idct', 'out', 'up', 'in'],
    ['up', 'out', 'rgb', 'in'],
    ['src', 'out', 'cmp', 'reference'],
    ['rgb', 'out', 'cmp', 'test'],
  ],
});

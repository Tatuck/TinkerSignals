import { defineExample } from '../types';

export default defineExample({
  id: 'jpeg-calidad',
  title: 'JPEG: calidad frente a bits',
  description:
    'El mismo paisaje con calidad 90 y 15: bits por píxel, PSNR, SSIM y el error ampliado.',
  topic: 'imagen',
  level: 'basico',
  audience: ['curiosear', 'probar'],
  order: 20,
  nodes: [
    { id: 'src', type: 'image-source', x: 0, y: 220, params: { image: 'paisaje', size: '256' } },
    { id: 'e1', type: 'jpeg-encoder', x: 340, y: 0, params: { quality: 90 } },
    { id: 'd1', type: 'jpeg-decoder', x: 680, y: 30 },
    { id: 'c1', type: 'image-comparator', x: 1000, y: 0 },
    { id: 'e2', type: 'jpeg-encoder', x: 340, y: 440, params: { quality: 15 } },
    { id: 'd2', type: 'jpeg-decoder', x: 680, y: 470 },
    { id: 'c2', type: 'image-comparator', x: 1000, y: 440 },
  ],
  edges: [
    ['src', 'out', 'e1', 'in'],
    ['e1', 'out', 'd1', 'in'],
    ['d1', 'out', 'c1', 'test'],
    ['src', 'out', 'c1', 'reference'],
    ['src', 'out', 'e2', 'in'],
    ['e2', 'out', 'd2', 'in'],
    ['d2', 'out', 'c2', 'test'],
    ['src', 'out', 'c2', 'reference'],
  ],
});

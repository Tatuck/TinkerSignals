import { blockDctPlane, expectPixels, makeImage } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'block-dct-2d',
  category: 'imagen',
  family: 'dct2d',
  familyRole: 'encoder',
  icon: '▦',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {
    blockSize: { type: 'select', default: '8', options: ['4', '8', '16'] },
  },
  process({ inputs, params }) {
    const img = inputs.in;
    expectPixels(img, 'La DCT 2D');
    const n = Number(params.blockSize);
    const planes = img.planes.map((p) => blockDctPlane(p, n));
    // Qué parte de la energía (sin contar la DC) se queda en el cuarto de
    // coeficientes de frecuencia más baja de cada bloque.
    const y = planes[0];
    let low = 0;
    let all = 0;
    for (let i = 0; i < y.data.length; i++) {
      const u = (i % y.width) % n;
      const v = Math.floor(i / y.width) % n;
      if (u === 0 && v === 0) continue;
      const e = y.data[i] * y.data[i];
      all += e;
      if (u < n / 2 && v < n / 2) low += e;
    }
    return {
      outputs: { out: makeImage(planes, img.color, 'dct', n) },
      metrics: [
        { key: 'lowEnergy', value: all > 0 ? (100 * low) / all : 100, unit: '%', highlight: true },
        { key: 'blocks', value: (y.width / n) * (y.height / n) },
      ],
    };
  },
});

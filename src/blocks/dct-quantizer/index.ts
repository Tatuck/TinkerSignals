import { makeImage } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';
import { quantizePlane, quantTable } from '../_shared/jpeg';

export default defineBlock({
  id: 'dct-quantizer',
  category: 'imagen',
  icon: '🧮',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'image' } },
  params: {
    quality: { type: 'number', default: 50, min: 1, max: 100, step: 1 },
    table: { type: 'select', default: 'jpeg', options: ['jpeg', 'uniform'] },
  },
  process({ inputs, params }) {
    const img = inputs.in;
    if (img.domain !== 'dct' || !img.blockSize) {
      throw new Error('El cuantizador trabaja con coeficientes. Ponlo detrás de una DCT 2D.');
    }
    const n = img.blockSize;
    const uniform = params.table === 'uniform';
    let zeros = 0;
    let total = 0;
    const planes = img.planes.map((p, c) => {
      const chroma = img.color === 'ycbcr' && c > 0;
      const q = quantizePlane(p, n, quantTable(n, chroma, params.quality, uniform));
      for (const v of q.data) if (v === 0) zeros++;
      total += q.data.length;
      return q;
    });
    const luma = quantTable(n, false, params.quality, uniform);
    return {
      outputs: { out: makeImage(planes, img.color, 'dct', n) },
      metrics: [
        { key: 'zeros', value: (100 * zeros) / Math.max(1, total), unit: '%', highlight: true },
        { key: 'minStep', value: Math.min(...luma) },
        { key: 'maxStep', value: Math.max(...luma) },
      ],
      plots: [
        {
          kind: 'bars',
          title: 'table',
          values: luma,
          labels: luma.map((v, i) => `(${Math.floor(i / n)}, ${i % n}): paso ${v}`),
        },
      ],
    };
  },
});

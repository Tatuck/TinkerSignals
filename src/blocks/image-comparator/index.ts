import {
  convertColor,
  expectPixels,
  imageMse,
  luminance,
  makeImage,
  makePlane,
  planeToRgba,
  psnrFromMse,
  ssim,
} from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'image-comparator',
  category: 'imagen',
  icon: '⚖️',
  inputs: { reference: { type: 'image' }, test: { type: 'image' } },
  outputs: { error: { type: 'image' } },
  params: {
    gain: { type: 'number', default: 4, min: 1, max: 32, step: 1, unit: '×' },
  },
  process({ inputs, params }) {
    const a = inputs.reference;
    const b = inputs.test;
    expectPixels(a, 'El comparador de imágenes');
    expectPixels(b, 'El comparador de imágenes');
    if (a.width !== b.width || a.height !== b.height) {
      throw new Error(
        `Las imágenes tienen distinto tamaño (${a.width}×${a.height} y ${b.width}×${b.height}).`,
      );
    }
    // Se comparan en el mismo espacio: en grises si alguna lo es; si no, en RGB.
    const space = a.color === 'gray' || b.color === 'gray' ? 'gray' : 'rgb';
    const ra = convertColor(a, space);
    const rb = convertColor(b, space);
    const mse = imageMse(ra, rb);
    const ya = luminance(ra);
    const yb = luminance(rb);
    const err = makePlane(a.width, a.height);
    let maxErr = 0;
    for (let i = 0; i < err.data.length; i++) {
      const d = ya.data[i] - yb.data[i];
      maxErr = Math.max(maxErr, Math.abs(d));
      err.data[i] = Math.max(0, Math.min(255, 128 + params.gain * d));
    }
    return {
      outputs: { error: makeImage([err], 'gray') },
      metrics: [
        { key: 'psnr', value: psnrFromMse(mse), unit: 'dB', highlight: true },
        { key: 'ssim', value: ssim(ya, yb), highlight: true },
        { key: 'rmse', value: Math.sqrt(mse) },
        { key: 'maxError', value: maxErr },
      ],
      plots: [{ kind: 'image', title: 'error', ...planeToRgba(err, 256) }],
    };
  },
});

import { mapFrames } from '@/engine/dsp/frames';
import { quantizeSymmetric } from '@/engine/dsp/quantize';
import { defineBlock } from '@/engine/types';

/** Cuantiza cada trama con su propio factor de escala (el máximo de la trama). */
export default defineBlock({
  id: 'frame-quantizer',
  category: 'piezas',
  icon: '📶',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {
    bits: { type: 'number', default: 6, min: 1, max: 16, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    let err = 0;
    let sig = 0;
    const out = mapFrames(inputs.in, inputs.in.domain, (f) => {
      let scale = 0;
      for (const v of f) scale = Math.max(scale, Math.abs(v));
      const g = Float32Array.from(f, (v) => quantizeSymmetric(v, scale, params.bits));
      for (let k = 0; k < f.length; k++) {
        sig += f[k] * f[k];
        err += (f[k] - g[k]) ** 2;
      }
      return g;
    });
    return {
      outputs: { out },
      metrics: [
        {
          key: 'snr',
          value: 10 * Math.log10((sig + 1e-20) / (err + 1e-20)),
          unit: 'dB',
          highlight: true,
        },
      ],
    };
  },
});

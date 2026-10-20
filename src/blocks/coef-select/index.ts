import { mapFrames } from '@/engine/dsp/frames';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'coef-select',
  category: 'piezas',
  icon: '🎯',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {
    keep: { type: 'number', default: 25, min: 1, max: 100, step: 1, unit: '%' },
    selection: { type: 'select', default: 'largest', options: ['low', 'largest'] },
  },
  process({ inputs, params }) {
    const N = inputs.in.size;
    const K = Math.max(1, Math.round((N * params.keep) / 100));
    let kept = 0;
    let total = 0;
    const out = mapFrames(inputs.in, inputs.in.domain, (f) => {
      const order =
        params.selection === 'low'
          ? Array.from({ length: K }, (_, k) => k)
          : Array.from({ length: N }, (_, k) => k)
              .sort((a, b) => Math.abs(f[b]) - Math.abs(f[a]))
              .slice(0, K);
      const g = new Float32Array(N);
      for (const k of order) g[k] = f[k];
      for (let k = 0; k < N; k++) {
        total += f[k] * f[k];
        kept += g[k] * g[k];
      }
      return g;
    });
    return {
      outputs: { out },
      metrics: [
        { key: 'kept', value: K, unit: `de ${N}`, highlight: true },
        { key: 'energyKept', value: total > 0 ? (100 * kept) / total : 100, unit: '%', highlight: true },
      ],
    };
  },
});

import { dct } from '@/engine/dsp/dct';
import { mapFrames } from '@/engine/dsp/frames';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'dct',
  category: 'piezas',
  family: 'dct',
  familyRole: 'encoder',
  icon: '🧮',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {},
  process({ inputs }) {
    if (inputs.in.domain !== 'time') throw new Error('La DCT espera tramas de muestras en el tiempo.');
    const out = mapFrames(inputs.in, 'dct', (f) => Float32Array.from(dct(f)));
    // Compactación de energía: qué fracción se lleva el 10 % de coeficientes más grandes.
    let top = 0;
    let total = 0;
    for (const f of out.data) {
      const e = Array.from(f, (v) => v * v).sort((a, b) => b - a);
      const k = Math.max(1, Math.round(e.length / 10));
      for (let i = 0; i < e.length; i++) {
        total += e[i];
        if (i < k) top += e[i];
      }
    }
    return {
      outputs: { out },
      metrics: [{ key: 'compaction', value: total > 0 ? (100 * top) / total : 0, unit: '%', highlight: true }],
    };
  },
});

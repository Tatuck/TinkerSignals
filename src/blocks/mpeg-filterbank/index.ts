import { defineBlock } from '@/engine/types';
import { BANDS, analysis } from '../_shared/mpeg1';

/** Banco de filtros de 32 subbandas iguales (MDCT de 64 puntos con ventana seno). */
export default defineBlock({
  id: 'mpeg-filterbank',
  category: 'piezas',
  family: 'filterbank',
  familyRole: 'encoder',
  icon: '🎼',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'frames' } },
  params: {},
  process({ inputs }) {
    const blocks = analysis(inputs.in.samples);
    return {
      outputs: {
        out: {
          kind: 'frames',
          domain: 'subbands',
          sampleRate: inputs.in.sampleRate,
          hop: BANDS,
          size: BANDS,
          numSamples: inputs.in.samples.length,
          data: blocks.map((b) => Float32Array.from(b)),
        },
      },
      metrics: [{ key: 'bandHz', value: inputs.in.sampleRate / 2 / BANDS, unit: 'Hz', highlight: true }],
      latencyMs: (1000 * BANDS) / inputs.in.sampleRate,
    };
  },
});

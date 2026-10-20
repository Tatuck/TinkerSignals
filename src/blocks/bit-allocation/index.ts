import { defineBlock } from '@/engine/types';
import {
  BANDS,
  SUBBAND_SAMPLES,
  allocate,
  availableBits,
  quantizeSubbandSample,
  scaleFactorIndex,
} from '../_shared/mpeg1';

/**
 * Reparte los bits de cada trama entre las 32 subbandas según la SMR y
 * cuantiza (y reconstruye) las muestras de cada subbanda con esos bits.
 */
export default defineBlock({
  id: 'bit-allocation',
  category: 'piezas',
  icon: '🧺',
  inputs: { subbands: { type: 'frames' }, smr: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {
    bitrate: { type: 'select', default: '128', options: ['32', '64', '96', '128', '192', '256', '384'] },
  },
  process({ inputs, params }) {
    const sb = inputs.subbands;
    if (sb.domain !== 'subbands' || inputs.smr.domain !== 'smr') {
      throw new Error('Conecta las subbandas del banco de filtros y la SMR del modelo psicoacústico.');
    }
    const fs = sb.sampleRate;
    const available = availableBits(Number(params.bitrate) * 1000, fs);
    const data = sb.data.map((f) => new Float32Array(f.length));
    const avg = new Float64Array(BANDS);
    const frames = Math.ceil(sb.data.length / SUBBAND_SAMPLES);
    for (let f = 0; f < frames; f++) {
      const rows = Array.from({ length: SUBBAND_SAMPLES }, (_, j) => sb.data[f * SUBBAND_SAMPLES + j]);
      const smr = Float64Array.from(inputs.smr.data[f] ?? new Float32Array(BANDS));
      const alloc = allocate(smr, available);
      for (let band = 0; band < BANDS; band++) {
        let peak = 0;
        for (const r of rows) if (r) peak = Math.max(peak, Math.abs(r[band]));
        const scf = scaleFactorIndex(peak);
        rows.forEach((r, j) => {
          if (r) data[f * SUBBAND_SAMPLES + j][band] = quantizeSubbandSample(r[band], alloc[band], scf);
        });
        avg[band] += alloc[band] / frames;
      }
    }
    return {
      outputs: { out: { ...sb, data } },
      metrics: [{ key: 'bandsUsed', value: Array.from(avg).filter((b) => b > 0.05).length, unit: `de ${BANDS}`, highlight: true }],
      plots: [{ kind: 'bars', title: 'allocation', values: Array.from(avg) }],
    };
  },
});

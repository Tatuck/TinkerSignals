import { mapFrames } from '@/engine/dsp/frames';
import { levinson } from '@/engine/dsp/lpc';
import { lpcEnvelopeDb } from '@/engine/dsp/voice';
import { defineBlock } from '@/engine/types';

/** Levinson-Durbin: de la autocorrelación a los coeficientes del predictor lineal. */
export default defineBlock({
  id: 'levinson',
  category: 'piezas',
  icon: '🧷',
  inputs: { in: { type: 'frames' } },
  outputs: { out: { type: 'frames' } },
  params: {},
  process({ inputs }) {
    if (inputs.in.domain !== 'autocorrelation')
      throw new Error('Levinson-Durbin espera autocorrelaciones.');
    const order = inputs.in.size - 1;
    let gainSum = 0;
    let n = 0;
    let best = { r0: -1, a: new Float64Array(order), err: 0 };
    const out = mapFrames(inputs.in, 'lpc', (r) => {
      const res = levinson(r, order);
      if (r[0] > 1e-9 && res.error > 0) {
        gainSum += 10 * Math.log10(r[0] / res.error);
        n++;
      }
      if (r[0] > best.r0) best = { r0: r[0], a: Float64Array.from(res.a), err: res.error };
      return Float32Array.from(res.a);
    });
    const env = lpcEnvelopeDb(best.a, Math.sqrt(Math.max(best.err, 1e-12)), 128);
    const hz = Array.from({ length: 128 }, (_, i) => (i * inputs.in.sampleRate) / 2 / 127);
    return {
      outputs: { out },
      metrics: [
        { key: 'predGain', value: n ? gainSum / n : 0, unit: 'dB', highlight: true },
        { key: 'order', value: order, highlight: true },
      ],
      plots: [
        {
          kind: 'line',
          title: 'envelope',
          series: [{ role: 'out', x: hz, y: env }],
          xLabel: 'f',
          yLabel: 'dB',
        },
      ],
    };
  },
});

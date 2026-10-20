import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

/** Retrasa la señal N muestras (o la adelanta si N es negativo, para compensar el retardo de un filtro). */
export default defineBlock({
  id: 'delay',
  category: 'piezas',
  icon: '⏳',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    samples: { type: 'number', default: 1, min: -2000, max: 2000, step: 1, unit: 'muestras' },
    length: { type: 'number', default: 0, min: 0, max: 1e9, step: 1, hidden: true },
  },
  process({ inputs, params }) {
    const x = inputs.in.samples;
    const n = params.length || x.length;
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = x[i - params.samples] ?? 0;
    return {
      outputs: { out: makeSignal(y, inputs.in.sampleRate) },
      metrics: [
        {
          key: 'delayMs',
          value: (1000 * params.samples) / inputs.in.sampleRate,
          unit: 'ms',
          highlight: true,
        },
      ],
      latencyMs: Math.max(0, (1000 * params.samples) / inputs.in.sampleRate),
    };
  },
});

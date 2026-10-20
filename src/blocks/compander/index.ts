import { compress, expand } from '@/engine/dsp/companding';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'compander',
  category: 'piezas',
  icon: '🗜️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    direction: { type: 'select', default: 'compress', options: ['compress', 'expand'] },
    law: { type: 'select', default: 'mu', options: ['mu', 'a'] },
    mu: {
      type: 'number',
      default: 255,
      min: 1,
      max: 1000,
      step: 1,
      scale: 'log',
      visibleIf: { param: 'law', equals: ['mu'] },
    },
  },
  process({ inputs, params }) {
    const f = params.direction === 'compress' ? compress : expand;
    const y = inputs.in.samples.map((v) => f(v, params.law, params.mu));
    const ramp = Array.from({ length: 200 }, (_, i) => -1 + (2 * i) / 199);
    return {
      outputs: { out: makeSignal(y, inputs.in.sampleRate) },
      plots: [
        {
          kind: 'line',
          title: 'curve',
          series: [
            { role: 'aux', x: ramp, y: ramp },
            { role: 'out', x: ramp, y: ramp.map((v) => f(v, params.law, params.mu)) },
          ],
          yRange: [-1, 1],
        },
      ],
    };
  },
});

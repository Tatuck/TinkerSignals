import { compress, expand } from '@/engine/dsp/companding';
import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { uniformIndex, uniformValue } from '@/engine/dsp/quantize';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'quantizer-nonuniform',
  category: 'digitalizacion',
  icon: '📈',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    bits: { type: 'number', default: 4, min: 1, max: 16, step: 1, unit: 'bits' },
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
    const { samples: x, sampleRate: fs } = inputs.in;
    const q = (v: number) =>
      expand(
        uniformValue(
          uniformIndex(compress(v, params.law, params.mu), params.bits, 'midrise'),
          params.bits,
          'midrise',
        ),
        params.law,
        params.mu,
      );
    const y = x.map(q);
    const ramp = Float32Array.from({ length: 400 }, (_, i) => -1 + (2 * i) / 399);
    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [
        { key: 'snr', value: snr(x, y), unit: 'dB', highlight: true },
        { key: 'bitrate', value: params.bits * fs, unit: 'bps', highlight: true },
        { key: 'levels', value: 2 ** params.bits },
      ],
      plots: [
        compareWaves(x, y, fs, { outStyle: 'step' }),
        {
          kind: 'line',
          title: 'transfer',
          series: [
            { role: 'aux', x: ramp, y: ramp },
            { role: 'out', x: ramp, y: ramp.map(q), style: 'step' },
          ],
          xLabel: 'x',
          yLabel: 'Q(x)',
          yRange: [-1, 1],
        },
      ],
    };
  },
});

import { compress, expand } from '@/engine/dsp/companding';
import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { uniformIndex, uniformValue } from '@/engine/dsp/quantize';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock, type InteriorGraph } from '@/engine/types';

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
  interior: (p): InteriorGraph => ({
    nodes: [
      { id: 'in', type: 'inner-signal-in', x: 0, y: 40 },
      {
        id: 'comp',
        type: 'compander',
        x: 300,
        y: 0,
        params: { direction: 'compress', law: p.law, mu: p.mu },
      },
      {
        id: 'q',
        type: 'quantizer-uniform',
        x: 600,
        y: 20,
        params: { bits: p.bits, mode: 'midrise' },
      },
      {
        id: 'exp',
        type: 'compander',
        x: 900,
        y: 0,
        params: { direction: 'expand', law: p.law, mu: p.mu },
      },
    ],
    edges: [
      ['in', 'out', 'comp', 'in'],
      ['comp', 'out', 'q', 'in'],
      ['q', 'out', 'exp', 'in'],
    ],
    inputs: { in: 'in' },
    outputs: { out: ['exp', 'out'] },
  }),
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

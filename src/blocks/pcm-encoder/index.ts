import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { compress } from '@/engine/dsp/companding';
import { entropy } from '@/engine/dsp/metrics';
import { defineBlock, type InteriorGraph } from '@/engine/types';
import { pcmEncode } from '../_shared/pcm';

export default defineBlock({
  id: 'pcm-encoder',
  category: 'digitalizacion',
  family: 'pcm',
  familyRole: 'encoder',
  icon: '🔢',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    bits: { type: 'number', default: 8, min: 2, max: 16, step: 1, unit: 'bits' },
    law: { type: 'select', default: 'mu', options: ['linear', 'mu', 'a'] },
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
  interior: (p): InteriorGraph => {
    const companded = p.law !== 'linear';
    return {
      nodes: [
        { id: 'in', type: 'inner-signal-in', x: 0, y: 40 },
        ...(companded
          ? [{ id: 'comp', type: 'compander', x: 300, y: 0, params: { direction: 'compress', law: p.law, mu: p.mu } }]
          : []),
        { id: 'q', type: 'quantizer-uniform', x: companded ? 600 : 300, y: 20, params: { bits: p.bits, mode: 'midrise' } },
        { id: 'bits', type: 'bit-packer', x: companded ? 900 : 600, y: 40, params: { bits: p.bits } },
      ],
      edges: companded
        ? [
            ['in', 'out', 'comp', 'in'],
            ['comp', 'out', 'q', 'in'],
            ['q', 'out', 'bits', 'in'],
          ]
        : [
            ['in', 'out', 'q', 'in'],
            ['q', 'out', 'bits', 'in'],
          ],
      inputs: { in: 'in' },
      outputs: { out: ['bits', 'out'] },
    };
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate } = inputs.in;
    const cfg = { bits: params.bits, law: params.law, mu: params.mu };
    const { writer, codes } = pcmEncode(x, cfg);
    const out = makeBitstream(
      writer,
      { codec: 'pcm', sampleRate, numSamples: x.length, symbolBits: params.bits, ...cfg },
      referenceBitsFor(x.length),
    );

    const ramp = Array.from({ length: 200 }, (_, i) => -1 + (2 * i) / 199);
    return {
      outputs: { out },
      metrics: [
        { key: 'bitrate', value: params.bits * sampleRate, unit: 'bps', highlight: true },
        { key: 'compression', value: 16 / params.bits, unit: '×', highlight: true },
        { key: 'entropy', value: entropy(codes), unit: 'bits' },
      ],
      plots: [
        {
          kind: 'line',
          title: 'curve',
          series: [
            { role: 'aux', x: ramp, y: ramp },
            { role: 'out', x: ramp, y: ramp.map((v) => compress(v, params.law, params.mu)) },
          ],
          xLabel: 'x',
          yLabel: 'F(x)',
          yRange: [-1, 1],
        },
      ],
    };
  },
});

import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { quantizeUniform } from '@/engine/dsp/quantize';

export default defineBlock({
  id: 'quantizer-uniform',
  category: 'digitalizacion',
  icon: '📶',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    bits: { type: 'number', default: 4, min: 1, max: 16, step: 1, unit: 'bits' },
    mode: { type: 'select', default: 'midrise', options: ['midrise', 'midtread'] as const },
  },
  process({ inputs, params }) {
    const x = inputs.in.samples;
    const fs = inputs.in.sampleRate;
    const y = quantizeUniform(x, params.bits, params.mode);

    // Escalera de cuantización: salida frente a entrada en [-1, 1].
    const ramp = Float32Array.from({ length: 400 }, (_, i) => -1 + (2 * i) / 399);
    const stairs = quantizeUniform(ramp, params.bits, params.mode);

    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [
        { key: 'snr', value: snr(x, y), unit: 'dB', highlight: true },
        { key: 'snrTheory', value: 6.02 * params.bits + 1.76, unit: 'dB' },
        { key: 'levels', value: 2 ** params.bits },
        { key: 'bitrate', value: params.bits * fs, unit: 'bps', highlight: true },
        { key: 'compression', value: 16 / params.bits, unit: '×' },
      ],
      plots: [
        compareWaves(x, y, fs, { outStyle: 'step' }),
        {
          kind: 'line',
          title: 'transfer',
          series: [
            { role: 'aux', y: ramp, x: ramp },
            { role: 'out', y: stairs, x: ramp, style: 'step' },
          ],
          xLabel: 'x',
          yLabel: 'Q(x)',
          yRange: [-1, 1],
        },
      ],
    };
  },
});

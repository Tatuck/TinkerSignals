import { applyBiquad, biquad, biquadResponseDb } from '@/engine/dsp/filters';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

const TUNABLE = ['lowpass', 'highpass', 'bandpass'] as const;

export default defineBlock({
  id: 'filter',
  category: 'utilidades',
  icon: '🎛️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    type: { type: 'select', default: 'lowpass', options: [...TUNABLE, 'telephone'] },
    cutoff: {
      type: 'number',
      default: 3400,
      min: 50,
      max: 20000,
      step: 1,
      unit: 'Hz',
      scale: 'log',
      visibleIf: { param: 'type', equals: TUNABLE },
    },
    q: {
      type: 'number',
      default: 0.71,
      min: 0.3,
      max: 10,
      step: 0.01,
      visibleIf: { param: 'type', equals: TUNABLE },
    },
    stages: { type: 'number', default: 2, min: 1, max: 4, step: 1 },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    // Banda telefónica (G.712): paso alto a 300 Hz + paso bajo a 3400 Hz.
    const sections =
      params.type === 'telephone'
        ? [biquad('highpass', 300, fs), biquad('lowpass', 3400, fs)]
        : [biquad(params.type, params.cutoff, fs, params.q)];
    let y = x;
    for (let s = 0; s < params.stages; s++) for (const f of sections) y = applyBiquad(y, f);
    const resp = new Float32Array(160);
    for (const f of sections) biquadResponseDb(f, 160).forEach((v, i) => (resp[i] += v * params.stages));
    const hz = Array.from({ length: resp.length }, (_, i) => (i * fs) / 2 / (resp.length - 1));
    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [
        {
          key: 'cutoff',
          value: params.type === 'telephone' ? 3400 : Math.min(params.cutoff, fs / 2),
          unit: 'Hz',
          highlight: true,
        },
        { key: 'slope', value: 12 * params.stages, unit: 'dB/oct' },
      ],
      plots: [
        {
          kind: 'line',
          title: 'response',
          series: [{ role: 'out', x: hz, y: resp }],
          xLabel: 'f',
          yLabel: 'dB',
          yRange: [-60, 6],
        },
        compareWaves(x, y, fs),
      ],
    };
  },
});

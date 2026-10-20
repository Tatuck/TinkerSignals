import { convolveCausal, convolveSame, firResponseDb, lowpassFir } from '@/engine/dsp/filters';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { QMF_H0, QMF_H1 } from '../_shared/subband';

/** Filtro FIR: convolución con una respuesta al impulso finita. */
export default defineBlock({
  id: 'fir-filter',
  category: 'piezas',
  icon: '〽️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    type: { type: 'select', default: 'lowpass', options: ['lowpass', 'highpass', 'qmf-low', 'qmf-high'] },
    cutoff: {
      type: 'number',
      default: 3400,
      min: 50,
      max: 22000,
      step: 10,
      unit: 'Hz',
      scale: 'log',
      visibleIf: { param: 'type', equals: ['lowpass', 'highpass'] },
    },
    taps: {
      type: 'number',
      default: 101,
      min: 3,
      max: 401,
      step: 2,
      visibleIf: { param: 'type', equals: ['lowpass', 'highpass'] },
    },
    gain: { type: 'number', default: 1, min: -4, max: 4, step: 0.5 },
  },
  process({ inputs, params }) {
    const fs = inputs.in.sampleRate;
    let h: Float64Array;
    let causal = false;
    if (params.type === 'qmf-low' || params.type === 'qmf-high') {
      h = params.type === 'qmf-low' ? QMF_H0 : QMF_H1;
      causal = true; // el QMF de longitud par necesita fase lineal causal
    } else {
      const lp = lowpassFir(Math.min(0.499, params.cutoff / fs), params.taps);
      // Paso alto = impulso − paso bajo (inversión espectral).
      h = params.type === 'lowpass' ? lp : lp.map((v, i) => (i === (params.taps - 1) / 2 ? 1 - v : -v));
    }
    const g = params.gain;
    const y = (causal ? convolveCausal : convolveSame)(inputs.in.samples, h).map((v) => v * g);
    const resp = firResponseDb(h, 160).map((v) => v + 20 * Math.log10(Math.abs(g) + 1e-12));
    const hz = Array.from({ length: 160 }, (_, i) => (i * fs) / 2 / 159);
    return {
      outputs: { out: makeSignal(y, fs) },
      metrics: [{ key: 'taps', value: h.length, highlight: true }],
      latencyMs: (((h.length - 1) / 2) * 1000) / fs,
      plots: [
        { kind: 'line', title: 'response', series: [{ role: 'out', x: hz, y: resp }], xLabel: 'f', yLabel: 'dB', yRange: [-80, 10] },
        { kind: 'bars', title: 'impulse', values: Array.from(h, (v) => v * g) },
      ],
    };
  },
});

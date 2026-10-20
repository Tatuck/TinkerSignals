import { segmentalSnr, snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'comparator',
  category: 'salida',
  icon: '⚖️',
  inputs: { reference: { type: 'signal' }, test: { type: 'signal' } },
  outputs: { error: { type: 'signal' } },
  params: {},
  process({ inputs }) {
    const a = inputs.reference;
    const b = inputs.test;
    if (a.sampleRate !== b.sampleRate) {
      throw new Error(
        `Las dos señales tienen distinta frecuencia de muestreo (${a.sampleRate} y ${b.sampleRate} Hz). Pon un Remuestreo delante para igualarlas.`,
      );
    }
    const n = Math.min(a.samples.length, b.samples.length);
    const ra = a.samples.subarray(0, n);
    const rb = b.samples.subarray(0, n);
    const e = new Float32Array(n);
    let maxErr = 0;
    for (let i = 0; i < n; i++) {
      e[i] = ra[i] - rb[i];
      maxErr = Math.max(maxErr, Math.abs(e[i]));
    }
    return {
      outputs: { error: makeSignal(e, a.sampleRate) },
      metrics: [
        { key: 'snr', value: snr(ra, rb), unit: 'dB', highlight: true },
        { key: 'snrSeg', value: segmentalSnr(ra, rb), unit: 'dB', highlight: true },
        { key: 'maxError', value: maxErr },
      ],
      plots: [compareWaves(ra, rb, a.sampleRate, { withError: true })],
    };
  },
});

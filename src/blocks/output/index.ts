import { snr } from '@/engine/dsp/metrics';
import { defineBlock } from '@/engine/types';

/**
 * Sumidero final. El audio lo reproduce y descarga la UI; el motor solo
 * informa de lo que llega (y del retardo total acumulado, que la UI lee
 * del cable de entrada).
 */
export default defineBlock({
  id: 'output',
  category: 'salida',
  icon: '🔊',
  inputs: { in: { type: 'signal' }, reference: { type: 'signal', optional: true } },
  outputs: {},
  params: {},
  process({ inputs }) {
    const { samples, sampleRate } = inputs.in;
    const metrics = [
      { key: 'duration', value: samples.length / sampleRate, unit: 's' },
      { key: 'sampleRate', value: sampleRate, unit: 'Hz' },
    ];
    if (inputs.reference) {
      metrics.unshift({ key: 'snr', value: snr(inputs.reference.samples, samples), unit: 'dB' });
    }
    return { outputs: {}, metrics };
  },
});

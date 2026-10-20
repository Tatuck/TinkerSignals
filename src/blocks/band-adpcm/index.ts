import { makeSignal } from '@/engine/dsp/signal';
import { snr } from '@/engine/dsp/metrics';
import { defineBlock } from '@/engine/types';
import { bandAdpcm } from '../_shared/subband';

/** ADPCM con paso adaptativo de Jayant: codifica y decodifica en un paso. */
export default defineBlock({
  id: 'band-adpcm',
  category: 'piezas',
  icon: '🎚️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {
    bits: { type: 'number', default: 4, min: 2, max: 8, step: 1, unit: 'bits' },
    predictor: { type: 'select', default: 'low', options: ['low', 'high'] },
  },
  process({ inputs, params }) {
    const y = bandAdpcm(inputs.in.samples, params.bits, params.predictor);
    return {
      outputs: { out: makeSignal(y, inputs.in.sampleRate) },
      metrics: [
        { key: 'snr', value: snr(inputs.in.samples, y), unit: 'dB', highlight: true },
        { key: 'bitrate', value: params.bits * inputs.in.sampleRate, unit: 'bps', highlight: true },
      ],
    };
  },
});

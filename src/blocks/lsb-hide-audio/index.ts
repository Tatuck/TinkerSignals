import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { hideBits, intsToSamples, signalToInts } from '../_shared/lsb';

export default defineBlock({
  id: 'lsb-hide-audio',
  category: 'utilidades',
  family: 'lsb-audio',
  familyRole: 'encoder',
  icon: '🕵️',
  inputs: { cover: { type: 'signal' }, message: { type: 'bitstream' } },
  outputs: { out: { type: 'signal' } },
  params: {
    bits: { type: 'number', default: 1, min: 1, max: 8, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const cover = inputs.cover;
    const ints = signalToInts(cover.samples);
    const { usedBits, capacityBits } = hideBits(ints, params.bits, inputs.message);
    const samples = intsToSamples(ints);
    return {
      outputs: { out: makeSignal(samples, cover.sampleRate) },
      metrics: [
        { key: 'used', value: (100 * usedBits) / capacityBits, unit: '%', highlight: true },
        { key: 'snr', value: snr(cover.samples, samples), unit: 'dB', highlight: true },
        { key: 'capacity', value: capacityBits / 8 / 1024, unit: 'KB' },
      ],
      plots: [compareWaves(cover.samples, samples, cover.sampleRate, { withError: true })],
    };
  },
});

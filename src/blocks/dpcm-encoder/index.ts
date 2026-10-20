import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { defineBlock, type Plot } from '@/engine/types';
import { dpcmEncode } from '../_shared/dpcm';

export default defineBlock({
  id: 'dpcm-encoder',
  category: 'diferencial',
  icon: '➖',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    order: { type: 'number', default: 2, min: 1, max: 12, step: 1 },
    bits: { type: 'number', default: 4, min: 1, max: 12, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate } = inputs.in;
    const enc = dpcmEncode(x, params.order, params.bits);
    const out = makeBitstream(
      enc.writer,
      { codec: 'dpcm', sampleRate, numSamples: x.length, bits: params.bits, symbolBits: params.bits },
      referenceBitsFor(x.length),
    );
    let px = 0;
    let pe = 0;
    for (let i = 0; i < x.length; i++) {
      px += x[i] * x[i];
      pe += enc.error[i] * enc.error[i];
    }
    return {
      outputs: { out },
      metrics: [
        { key: 'predGain', value: 10 * Math.log10((px + 1e-20) / (pe + 1e-20)), unit: 'dB', highlight: true },
        { key: 'bitrate', value: (out.bitLength * sampleRate) / x.length, unit: 'bps', highlight: true },
        { key: 'snrExpected', value: snr(x, enc.reconstructed), unit: 'dB' },
        { key: 'compression', value: out.referenceBits / out.bitLength, unit: '×' },
        { key: 'sideBits', value: enc.sideBits, unit: 'bits' },
      ],
      plots: [errorPlot(compareWaves(x, enc.error, sampleRate))],
    };
  },
});

/** Pinta el error de predicción en el color de "error" para que se distinga de la señal. */
function errorPlot(p: Plot): Plot {
  if (p.kind !== 'line') return p;
  return {
    ...p,
    title: 'error',
    series: p.series.map((s) => (s.role === 'out' ? { ...s, role: 'error' } : s)),
  };
}

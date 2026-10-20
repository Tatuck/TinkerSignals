import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { envelope } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { adpcmEncode } from '../_shared/adpcm';

export default defineBlock({
  id: 'adpcm-encoder',
  category: 'forma-de-onda',
  family: 'adpcm',
  familyRole: 'encoder',
  icon: '🎚️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {},
  process({ inputs }) {
    const { samples: x, sampleRate } = inputs.in;
    const enc = adpcmEncode(x);
    const out = makeBitstream(
      enc.writer,
      { codec: 'adpcm-ima', sampleRate, numSamples: x.length, symbolBits: 4 },
      referenceBitsFor(x.length),
    );
    const sig = envelope(x, 160).max;
    const steps = envelope(enc.steps, 160).max;
    let peakStep = 1e-9;
    let peakSig = 1e-9;
    for (let i = 0; i < steps.length; i++) {
      peakStep = Math.max(peakStep, steps[i]);
      peakSig = Math.max(peakSig, sig[i]);
    }
    return {
      outputs: { out },
      metrics: [
        { key: 'bitrate', value: 4 * sampleRate, unit: 'bps', highlight: true },
        { key: 'snrExpected', value: snr(x, enc.reconstructed), unit: 'dB', highlight: true },
        { key: 'compression', value: 4, unit: '×' },
      ],
      plots: [
        compareWaves(x, enc.reconstructed, sampleRate),
        {
          kind: 'line',
          title: 'step',
          series: [
            { role: 'in', y: sig.map((v) => v / peakSig) },
            { role: 'out', y: steps.map((v) => v / peakStep) },
          ],
          yRange: [0, 1],
        },
      ],
    };
  },
});

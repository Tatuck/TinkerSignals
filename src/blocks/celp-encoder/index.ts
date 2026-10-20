import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { segmentalSnr, snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { lpcEnvelopeDb } from '@/engine/dsp/voice';
import { defineBlock } from '@/engine/types';
import { celpBitsPerFrame, celpConfig, celpEncode } from '../_shared/celp';

export default defineBlock({
  id: 'celp-encoder',
  category: 'voz',
  family: 'celp',
  familyRole: 'encoder',
  icon: '📚',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    order: { type: 'number', default: 10, min: 2, max: 20, step: 1 },
    codebookSize: { type: 'select', default: '256', options: ['16', '64', '256', '512', '1024'] },
    gamma: { type: 'number', default: 0.85, min: 0.5, max: 1, step: 0.01 },
    frameMs: { type: 'number', default: 30, min: 10, max: 40, step: 2.5, unit: 'ms' },
    subframes: { type: 'select', default: '4', options: ['1', '2', '4', '8'] },
    adaptive: { type: 'boolean', default: true },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const cfg = celpConfig(fs, {
      frameMs: params.frameMs,
      subframes: Number(params.subframes),
      order: params.order,
      codebookSize: Number(params.codebookSize),
      gamma: params.gamma,
      adaptive: params.adaptive,
    });
    const enc = celpEncode(x, cfg);
    const out = makeBitstream(
      enc.writer,
      { codec: 'celp', sampleRate: fs, numSamples: x.length, ...cfg },
      referenceBitsFor(x.length),
    );
    const bpf = celpBitsPerFrame(cfg);
    const hz = Array.from({ length: 128 }, (_, i) => (i * fs) / 2 / 127);
    const env = lpcEnvelopeDb(enc.lastA, 1, 128);
    const weighted = lpcEnvelopeDb(
      enc.lastA.map((v, i) => v * params.gamma ** (i + 1)),
      1,
      128,
    );
    return {
      outputs: { out },
      metrics: [
        { key: 'bitrate', value: (bpf * fs) / cfg.frameLen, unit: 'bps', highlight: true },
        { key: 'snrSeg', value: segmentalSnr(x, enc.reconstructed), unit: 'dB', highlight: true },
        { key: 'snr', value: snr(x, enc.reconstructed), unit: 'dB' },
        { key: 'compression', value: out.referenceBits / out.bitLength, unit: '×' },
        { key: 'bitsPerFrame', value: bpf, unit: 'bits' },
        { key: 'subframeMs', value: (cfg.frameLen / cfg.subframes / fs) * 1000, unit: 'ms' },
      ],
      latencyMs: ((cfg.frameLen + enc.lookaheadSamples) / fs) * 1000,
      plots: [
        compareWaves(x, enc.reconstructed, fs, { ms: 20 }),
        {
          kind: 'line',
          title: 'weighting',
          series: [
            { role: 'in', x: hz, y: env },
            { role: 'out', x: hz, y: weighted },
          ],
          xLabel: 'f',
          yLabel: 'dB',
        },
      ],
    };
  },
});

import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import {
  detectPitch,
  frameAt,
  frameSpectrumDb,
  lpcEnvelopeDb,
  lpcFrame,
  residualRms,
} from '@/engine/dsp/voice';
import { defineBlock, type InteriorGraph } from '@/engine/types';
import { bitsPerFrame, lpcConfig, lpcEncode } from '../_shared/lpc-vocoder';

export default defineBlock({
  id: 'lpc-encoder',
  category: 'voz',
  family: 'lpc',
  familyRole: 'encoder',
  icon: '🔬',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    order: { type: 'number', default: 10, min: 2, max: 24, step: 1 },
    frameMs: { type: 'number', default: 20, min: 10, max: 40, step: 2.5, unit: 'ms' },
    kBits: { type: 'number', default: 5, min: 2, max: 10, step: 1, unit: 'bits' },
  },
  interior: (p, inputs): InteriorGraph => {
    const fs = inputs.in?.kind === 'signal' ? inputs.in.sampleRate : 8000;
    const N = Math.max(32, Math.round((p.frameMs / 1000) * fs));
    return {
      nodes: [
        { id: 'in', type: 'inner-signal-in', x: 0, y: 40 },
        {
          id: 'frames',
          type: 'framer',
          x: 300,
          y: 20,
          params: { exactSize: Math.round(1.5 * N), exactHop: N, window: 'hamming' },
        },
        { id: 'r', type: 'autocorrelation', x: 600, y: 0, params: { order: p.order } },
        { id: 'lpc', type: 'levinson', x: 900, y: 0 },
        { id: 'spec', type: 'fft', x: 300, y: 380, params: { size: '512', window: 'hann' } },
      ],
      edges: [
        ['in', 'out', 'frames', 'in'],
        ['frames', 'out', 'r', 'in'],
        ['r', 'out', 'lpc', 'in'],
        ['in', 'out', 'spec', 'in'],
      ],
      inputs: { in: 'in' },
      outputs: {},
    };
  },
  inspectAt({ inputs, params, timeS }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const cfg = lpcConfig(fs, params.frameMs, params.order, params.kBits);
    const start = Math.max(0, Math.floor((timeS * fs) / cfg.frameLen) * cfg.frameLen);
    const look = Math.round(cfg.frameLen * 0.25);
    const win = frameAt(x, start - look, Math.round(cfg.frameLen * 1.5));
    const { a } = lpcFrame(win, params.order);
    const gain = residualRms(x, start, cfg.frameLen, a);
    const pitch = detectPitch(win, fs);
    const spec = frameSpectrumDb(frameAt(x, start, cfg.frameLen), 160);
    const env = lpcEnvelopeDb(a, gain, 160);
    const shift = Math.max(...spec) - Math.max(...env);
    const hz = Array.from({ length: 160 }, (_, i) => (i * fs) / 2 / 159);
    return [
      {
        kind: 'line',
        title: pitch.voiced ? 'envelopeVoiced' : 'envelopeUnvoiced',
        series: [
          { role: 'in', x: hz, y: spec },
          { role: 'out', x: hz, y: env.map((v) => v + shift) },
        ],
        xLabel: 'f',
        yLabel: 'dB',
      },
    ];
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const cfg = lpcConfig(fs, params.frameMs, params.order, params.kBits);
    const { writer, frames, lookaheadSamples } = lpcEncode(x, fs, cfg);
    const out = makeBitstream(
      writer,
      { codec: 'lpc', sampleRate: fs, numSamples: x.length, ...cfg },
      referenceBitsFor(x.length),
    );

    // Trama de más energía: espectro real frente a envolvente LPC.
    let best = 0;
    frames.forEach((f, i) => {
      if (f.gain > frames[best].gain) best = i;
    });
    const seg = frameAt(x, best * cfg.frameLen, cfg.frameLen);
    const spec = frameSpectrumDb(seg, 160);
    const env = lpcEnvelopeDb(frames[best]?.a ?? [], frames[best]?.gain ?? 0, 160);
    // Alinea la envolvente con el espectro (solo importa la forma).
    const shift = Math.max(...spec) - Math.max(...env);
    const hz = Array.from({ length: 160 }, (_, i) => (i * fs) / 2 / 159);

    const voiced = frames.filter((f) => f.voiced).length;
    return {
      outputs: { out },
      metrics: [
        {
          key: 'bitrate',
          value: (bitsPerFrame(cfg) * fs) / cfg.frameLen,
          unit: 'bps',
          highlight: true,
        },
        {
          key: 'compression',
          value: out.referenceBits / out.bitLength,
          unit: '×',
          highlight: true,
        },
        { key: 'bitsPerFrame', value: bitsPerFrame(cfg), unit: 'bits' },
        { key: 'voicedPct', value: (100 * voiced) / Math.max(1, frames.length), unit: '%' },
      ],
      latencyMs: ((cfg.frameLen + lookaheadSamples) / fs) * 1000,
      plots: [
        {
          kind: 'line',
          title: 'envelope',
          series: [
            { role: 'in', x: hz, y: spec },
            { role: 'out', x: hz, y: env.map((v) => v + shift) },
          ],
          xLabel: 'f',
          yLabel: 'dB',
        },
        {
          kind: 'line',
          title: 'pitch',
          series: [
            { role: 'out', y: frames.map((f) => (f.voiced ? fs / f.lag : 0)), style: 'step' },
          ],
          yLabel: 'Hz',
        },
      ],
    };
  },
});

import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { frameAt, frameSpectrumDb, lpcEnvelopeDb } from '@/engine/dsp/voice';
import { defineBlock } from '@/engine/types';
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

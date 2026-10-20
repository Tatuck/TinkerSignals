import { makeBitstream, referenceBitsFor } from '@/engine/dsp/bitstream';
import { defineBlock, type Plot } from '@/engine/types';
import { BANDS, FRAME, mpeg1Encode } from '../_shared/mpeg1';

const RATES = ['32', '64', '96', '128', '192', '256', '384'] as const;

export default defineBlock({
  id: 'mpeg1-encoder',
  category: 'perceptual',
  family: 'mpeg1',
  familyRole: 'encoder',
  icon: '👂',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    bitrate: { type: 'select', default: '128', options: RATES },
    psychoacoustic: { type: 'boolean', default: true },
  },
  process({ inputs, params }) {
    const { samples: x, sampleRate: fs } = inputs.in;
    const bitrate = Number(params.bitrate) * 1000;
    if (bitrate * FRAME < fs * (32 + BANDS * 4 + 30)) {
      throw new Error(
        'La tasa es demasiado baja para esta frecuencia de muestreo: súbela o remuestrea la señal.',
      );
    }
    const enc = mpeg1Encode(x, fs, bitrate, params.psychoacoustic);
    const out = makeBitstream(
      enc.writer,
      { codec: 'mpeg1-l1', sampleRate: fs, numSamples: x.length, bitrate },
      referenceBitsFor(x.length),
    );
    const used = enc.stats.avgAlloc.filter((b) => b > 0.05).length;
    const plots: Plot[] = [];
    if (enc.stats.sample) {
      const hz = Array.from(
        { length: enc.stats.sample.spectrum.length },
        (_, k) => (k * fs) / (2 * enc.stats.sample!.spectrum.length),
      );
      plots.push({
        kind: 'line',
        title: 'masking',
        series: [
          { role: 'in', x: hz, y: Array.from(enc.stats.sample.spectrum) },
          { role: 'out', x: hz, y: Array.from(enc.stats.sample.threshold) },
        ],
        xLabel: 'f',
        yLabel: 'dB',
        yRange: [-10, 100],
      });
    }
    plots.push({
      kind: 'bars',
      title: 'allocation',
      values: Array.from(enc.stats.avgAlloc),
      labels: Array.from(
        enc.stats.avgAlloc,
        (b, sb) =>
          `Banda ${sb} (${Math.round((sb * fs) / 2 / BANDS)}–${Math.round(((sb + 1) * fs) / 2 / BANDS)} Hz): ${b.toFixed(1)} bits/muestra`,
      ),
    });
    return {
      outputs: { out },
      metrics: [
        { key: 'bitrate', value: (out.bitLength * fs) / x.length, unit: 'bps', highlight: true },
        {
          key: 'compression',
          value: out.referenceBits / out.bitLength,
          unit: '×',
          highlight: true,
        },
        { key: 'bandsUsed', value: used, unit: `de ${BANDS}` },
        { key: 'frames', value: enc.frames },
      ],
      // Trama + solapamiento del banco de filtros + mitad sobrante de la FFT del modelo.
      latencyMs: ((FRAME + BANDS + (512 - FRAME) / 2) / fs) * 1000,
      plots,
    };
  },
});

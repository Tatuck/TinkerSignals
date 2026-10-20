import { bitsToString } from '@/engine/dsp/bits';
import { averageSpectrumDb, spectrogramDb } from '@/engine/dsp/fft';
import { envelope } from '@/engine/dsp/signal';
import type { PortValue } from '@/engine/types';

/** Datos listos para pintar en el inspector de un cable. */
export type ProbeData =
  | {
      kind: 'signal';
      sampleRate: number;
      wave: { min: Float32Array; max: Float32Array };
      spectrum: Float32Array;
      spectrogram: Float32Array[];
    }
  | {
      kind: 'bitstream';
      bits: string;
      onesRatio: number;
      bitLength: number;
      header: Record<string, unknown>;
    }
  | {
      kind: 'packets';
      /** Retardo de cada paquete (ms); null si se perdió. */
      delays: (number | null)[];
      lostReasons: (string | null)[];
      overheadBits: number;
      payloadBits: number;
    };

export function probe(v: PortValue): ProbeData {
  if (v.kind === 'signal') {
    return {
      kind: 'signal',
      sampleRate: v.sampleRate,
      wave: envelope(v.samples, 600),
      spectrum: averageSpectrumDb(v.samples, 1024),
      spectrogram: spectrogramDb(v.samples, 512, 160),
    };
  }
  if (v.kind === 'packets') {
    return {
      kind: 'packets',
      delays: v.packets.map((p) => (p.arrivalMs === null ? null : p.arrivalMs - p.sentMs)),
      lostReasons: v.packets.map((p) => p.lostReason ?? null),
      overheadBits: v.overheadBits,
      payloadBits: v.packets[0]?.payloadBits ?? 0,
    };
  }
  let ones = 0;
  for (let i = 0; i < v.bytes.length; i++) {
    let b = v.bytes[i];
    while (b) {
      ones += b & 1;
      b >>= 1;
    }
  }
  return {
    kind: 'bitstream',
    bits: bitsToString(v.bytes, v.bitLength, 256),
    onesRatio: v.bitLength ? ones / v.bitLength : 0,
    bitLength: v.bitLength,
    header: v.header,
  };
}

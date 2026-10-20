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
      kind: 'frames';
      domain: string;
      /** Mapa de calor |valor| en dB: [trama][índice], reducido para pintar. */
      heat: Float32Array[];
      /** La trama de más energía, entera. */
      loudest: Float32Array;
      loudestIndex: number;
      hop: number;
      sampleRate: number;
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
  if (v.kind === 'frames') {
    const cols = Math.min(200, v.data.length);
    const rows = Math.min(128, v.size);
    const heat: Float32Array[] = [];
    for (let c = 0; c < cols; c++) {
      const f = v.data[Math.floor((c * v.data.length) / cols)];
      const col = new Float32Array(rows);
      for (let r = 0; r < rows; r++) {
        const a = Math.floor((r * v.size) / rows);
        const b = Math.max(a + 1, Math.floor(((r + 1) * v.size) / rows));
        let m = 0;
        for (let k = a; k < b; k++) m = Math.max(m, Math.abs(f[k]));
        col[r] = v.domain === 'spectrum' ? f[a] : 20 * Math.log10(m + 1e-9);
      }
      heat.push(col);
    }
    let loudestIndex = 0;
    let best = -1;
    v.data.forEach((f, i) => {
      let e = 0;
      for (const x of f) e += x * x;
      if (e > best) {
        best = e;
        loudestIndex = i;
      }
    });
    return {
      kind: 'frames',
      domain: v.domain,
      heat,
      loudest: v.data[loudestIndex] ?? new Float32Array(0),
      loudestIndex,
      hop: v.hop,
      sampleRate: v.sampleRate,
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

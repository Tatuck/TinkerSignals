import { bitsToString } from '@/engine/dsp/bits';
import { averageSpectrumDb, spectrogramDb } from '@/engine/dsp/fft';
import { toRgba, type Rgba } from '@/engine/dsp/image';
import { envelope } from '@/engine/dsp/signal';
import type { BitSpan, Bitstream, PortValue } from '@/engine/types';

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
      kind: 'image';
      /** La imagen a buen tamaño para verla en el panel. */
      view: Rgba;
      /** Cada plano por separado (Y, Cb, Cr…), en gris y a su tamaño real. */
      planes: Rgba[];
      /** Histograma de 64 grupos de cada plano (solo en píxeles). */
      histograms: number[][];
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
  if (v.kind === 'image') {
    return {
      kind: 'image',
      view: toRgba(v, 320),
      planes:
        v.planes.length > 1
          ? v.planes.map((p) =>
              toRgba({ ...v, color: 'gray', planes: [p], width: p.width, height: p.height }, 160),
            )
          : [],
      histograms:
        v.domain === 'pixels'
          ? v.planes.map((p) => {
              const h = new Array<number>(64).fill(0);
              for (const x of p.data) h[Math.max(0, Math.min(63, Math.floor(x / 4)))]++;
              return h;
            })
          : [],
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

// ─── Visor de bits ──────────────────────────────────────────────────────────

/** Un campo del flujo tal como llega por el cable. */
export interface BitFieldView {
  field: string;
  start: number;
  length: number;
  /** Los bits como llegan (si el canal los ha dañado, ya dañados). */
  bits: string;
  /** Posiciones (dentro del campo) de los bits dañados. */
  hurt: number[];
  /** Valor que escribió el codificador. */
  value: number;
  /** Qué significa ese valor, si el bloque sabe decirlo. */
  meaning?: string;
  frame: number;
}

export interface BitsProbe {
  /** Bloque que escribió el flujo (de él salen los nombres de los campos). */
  block?: string;
  fields: string[];
  /** Bits de cada campo en todo el flujo. */
  totals: number[];
  totalBits: number;
  frames: number;
  /** Primera trama enseñada (−1: cabecera) y cuántas se enseñan. */
  frame: number;
  shownFrames: number;
  hasHeader: boolean;
  /** Duración de una trama (s), si el flujo es de audio; 0 si no. */
  frameSeconds: number;
  spans: BitFieldView[];
  /** La trama pedida está más allá de las que se guardaron. */
  beyond: boolean;
  damagedBits: number;
  /** Primeras tramas con algún bit dañado (para saltar a ellas). */
  damagedFrames: number[];
}

type Describe = (field: string, value: number, header: Bitstream['header']) => string | undefined;

/** Mira los campos de unas pocas tramas a partir de `frame`. */
export function probeBits(v: Bitstream, frame: number, describe?: Describe): BitsProbe | null {
  const L = v.layout;
  if (!L || L.bitLength !== v.bitLength || !L.spans.length) return null;
  const spans = L.spans;
  const hasHeader = spans[0].frame < 0;
  const lastFrame = spans[spans.length - 1].frame;
  const f0 = Math.max(hasHeader ? -1 : 0, Math.min(frame, L.frames - 1));

  // Las tramas muy cortas (una muestra PCM) se enseñan de varias en varias.
  let i = lowerBound(spans, f0);
  const out: BitFieldView[] = [];
  let shown = 0;
  let current = Number.NaN;
  const damage = sortedDamage(v.damaged);
  while (i < spans.length && out.length < 400) {
    const s = spans[i];
    if (s.frame !== current) {
      if (shown >= 16 || (shown > 0 && (f0 < 0 || out.length >= 24 || out.length / shown >= 6)))
        break;
      current = s.frame;
      shown++;
    }
    out.push({
      field: L.fields[s.field],
      start: s.start,
      length: s.length,
      bits: readBits(v.bytes, s.start, s.length),
      hurt: hurtIn(damage, s.start, s.length),
      value: s.value,
      meaning: describe?.(L.fields[s.field], s.value, v.header),
      frame: s.frame,
    });
    i++;
  }

  const damagedFrames: number[] = [];
  for (const [start] of damage) {
    const k = upperByStart(spans, start);
    const fr = spans[k]?.frame;
    if (fr !== undefined && fr !== damagedFrames[damagedFrames.length - 1]) damagedFrames.push(fr);
    if (damagedFrames.length >= 50) break;
  }

  const duration = v.header.sampleRate > 0 ? v.header.numSamples / v.header.sampleRate : 0;
  return {
    block: L.block,
    fields: L.fields,
    totals: L.totals,
    totalBits: v.bitLength,
    frames: L.frames,
    frame: f0,
    shownFrames: shown,
    hasHeader,
    frameSeconds: duration > 0 && L.frames > 0 ? duration / L.frames : 0,
    spans: out,
    beyond: f0 > lastFrame,
    damagedBits: damage.reduce((a, [, n]) => a + n, 0),
    damagedFrames,
  };
}

/** Primer tramo de la trama `f` o posterior (los tramos van en orden de trama). */
function lowerBound(spans: BitSpan[], f: number): number {
  let lo = 0;
  let hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].frame < f) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Tramo que contiene el bit `pos` (los tramos van en orden de posición). */
function upperByStart(spans: BitSpan[], pos: number): number {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (spans[mid].start <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function sortedDamage(d: Bitstream['damaged']): [number, number][] {
  return d ? [...d].sort((a, b) => a[0] - b[0]) : [];
}

function hurtIn(damage: [number, number][], start: number, length: number): number[] {
  const out: number[] = [];
  for (const [s, n] of damage) {
    if (s >= start + length) break;
    for (let p = Math.max(s, start); p < Math.min(s + n, start + length); p++) out.push(p - start);
  }
  return out;
}

function readBits(bytes: Uint8Array, start: number, length: number): string {
  let s = '';
  for (let i = start; i < start + length; i++) s += (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  return s;
}

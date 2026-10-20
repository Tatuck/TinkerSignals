import { BitReader, BitWriter } from '@/engine/dsp/bits';
import { fft, hann } from '@/engine/dsp/fft';

/**
 * Codificador perceptual con la estructura de MPEG-1 Audio Layer I.
 *
 *  - Banco de 32 subbandas de igual anchura. El estándar usa un banco
 *    polifásico de 512 coeficientes; aquí se usa una MDCT de 64 puntos con
 *    ventana seno, que divide en las mismas 32 bandas y reconstruye de forma
 *    perfecta (así el único error es el de cuantización).
 *  - Tramas de 384 muestras = 12 muestras por subbanda.
 *  - Un factor de escala de 6 bits por subbanda y trama.
 *  - Modelo psicoacústico (simplificación del modelo 1 del estándar): FFT de
 *    512 puntos, enmascaradores tonales y de ruido, función de dispersión en
 *    la escala Bark y umbral absoluto de audición. Da la SMR de cada subbanda.
 *  - Asignación de bits iterativa: va dando bits a la subbanda cuyo ruido de
 *    cuantización está más por encima del umbral de enmascaramiento.
 *
 * Formato por trama:
 *   [cabecera: 32][asignación: 32 × 4][factor de escala: 6 por subbanda con bits]
 *   [12 × b bits por subbanda]
 */
export const BANDS = 32;
export const FRAME = 384;
const SAMPLES_PER_BAND = FRAME / BANDS; // 12
const HEADER_BITS = 32;
const ALLOC_BITS = 4;
const SCF_BITS = 6;
const FFT_SIZE = 512;

/** Factores de escala del estándar: 2 · 2^(−i/3), i = 0…62. */
const SCALE_FACTORS = Float64Array.from({ length: 63 }, (_, i) => 2 * 2 ** (-i / 3));

/** SNR (dB) de un cuantizador de 2^b − 1 niveles (tabla del estándar, aproximada). */
const SNR_TABLE = [
  0, 0, 7.0, 16.0, 25.28, 31.59, 37.75, 43.84, 49.89, 55.93, 61.96, 67.98, 74.01, 80.03, 86.05,
  92.01,
];

// ─── Banco de filtros (MDCT) ────────────────────────────────────────────────

const N2 = 2 * BANDS;
const WINDOW = Float64Array.from({ length: N2 }, (_, n) => Math.sin((Math.PI * (n + 0.5)) / N2));
const BASIS = Array.from({ length: BANDS }, (_, k) =>
  Float64Array.from(
    { length: N2 },
    (_, n) =>
      Math.sqrt(2 / BANDS) * Math.cos((Math.PI / BANDS) * (n + 0.5 + BANDS / 2) * (k + 0.5)),
  ),
);

/** 32 coeficientes por cada 32 muestras nuevas (bloques de 64 solapados al 50 %). */
export function analysis(x: Float32Array): Float64Array[] {
  const blocks = Math.ceil(x.length / BANDS) + 1;
  const out: Float64Array[] = [];
  for (let b = 0; b < blocks; b++) {
    const start = (b - 1) * BANDS;
    const c = new Float64Array(BANDS);
    for (let k = 0; k < BANDS; k++) {
      let s = 0;
      for (let n = 0; n < N2; n++) s += (x[start + n] ?? 0) * WINDOW[n] * BASIS[k][n];
      c[k] = s;
    }
    out.push(c);
  }
  return out;
}

export function synthesis(blocks: Float64Array[], length: number): Float32Array {
  const y = new Float32Array(length);
  blocks.forEach((c, b) => {
    const start = (b - 1) * BANDS;
    for (let n = 0; n < N2; n++) {
      const i = start + n;
      if (i < 0 || i >= length) continue;
      let s = 0;
      for (let k = 0; k < BANDS; k++) s += c[k] * BASIS[k][n];
      y[i] += s * WINDOW[n];
    }
  });
  return y;
}

// ─── Modelo psicoacústico ───────────────────────────────────────────────────

const bark = (f: number) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);

/** Umbral absoluto de audición (Terhardt), en dB SPL. */
export function absoluteThreshold(f: number): number {
  const k = Math.max(f, 20) / 1000;
  return 3.64 * k ** -0.8 - 6.5 * Math.exp(-0.6 * (k - 3.3) ** 2) + 1e-3 * k ** 4;
}

/** Función de dispersión del modelo 1: cuánto enmascara un tono a distancia dz Bark. */
function spreading(dz: number, level: number): number {
  if (dz < -3 || dz >= 8) return -Infinity;
  if (dz < -1) return 17 * (dz + 1) - (0.4 * level + 6);
  if (dz < 0) return (0.4 * level + 6) * dz;
  if (dz < 1) return -17 * dz;
  return -(dz - 1) * (17 - 0.15 * level) - 17;
}

export interface PsychoResult {
  /** Relación señal/máscara de cada subbanda (dB). */
  smr: Float64Array;
  /** Espectro de la trama (dB, 256 puntos). */
  spectrum: Float64Array;
  /** Umbral de enmascaramiento global (dB, 256 puntos). */
  threshold: Float64Array;
}

const HANN = hann(FFT_SIZE);
/** Normalización del modelo 1: una senoidal a fondo de escala da 96 dB. */
const LEVEL_OFFSET = 96 - 10 * Math.log10((FFT_SIZE / 4) ** 2);

export function psychoacoustic(x: Float32Array, frameStart: number, fs: number): PsychoResult {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const offset = frameStart + FRAME / 2 - FFT_SIZE / 2;
  for (let i = 0; i < FFT_SIZE; i++) re[i] = (x[offset + i] ?? 0) * HANN[i];
  fft(re, im);
  const half = FFT_SIZE / 2;
  const P = new Float64Array(half);
  for (let k = 0; k < half; k++)
    P[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12) + LEVEL_OFFSET;
  const freq = (k: number) => (k * fs) / FFT_SIZE;
  const z = Float64Array.from({ length: half }, (_, k) => bark(freq(k)));

  // Enmascaradores tonales: máximos locales 7 dB por encima de sus vecinos.
  const maskers: { k: number; level: number; tonal: boolean }[] = [];
  const isTonal = new Uint8Array(half);
  for (let k = 3; k < half - 6; k++) {
    if (P[k] <= P[k - 1] || P[k] < P[k + 1]) continue;
    const reach = k < 63 ? 2 : k < 127 ? 3 : 6;
    let tonal = true;
    for (let j = 2; j <= reach && tonal; j++)
      if (P[k] - P[k - j] < 7 || P[k] - P[k + j] < 7) tonal = false;
    if (!tonal) continue;
    const level =
      10 * Math.log10(10 ** (P[k - 1] / 10) + 10 ** (P[k] / 10) + 10 ** (P[k + 1] / 10));
    maskers.push({ k, level, tonal: true });
    for (let j = -reach; j <= reach; j++) isTonal[k + j] = 1;
  }
  // Enmascaradores de ruido: la energía restante de cada banda crítica (1 Bark).
  const noise = new Map<number, { power: number; kSum: number; n: number }>();
  for (let k = 1; k < half; k++) {
    if (isTonal[k]) continue;
    const band = Math.floor(z[k]);
    const e = noise.get(band) ?? { power: 0, kSum: 0, n: 0 };
    e.power += 10 ** (P[k] / 10);
    e.kSum += k;
    e.n++;
    noise.set(band, e);
  }
  for (const e of noise.values()) {
    maskers.push({
      k: Math.round(e.kSum / e.n),
      level: 10 * Math.log10(e.power + 1e-12),
      tonal: false,
    });
  }

  // Umbral global = suma de potencias de los umbrales individuales + umbral absoluto.
  const threshold = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    let sum = 10 ** (absoluteThreshold(freq(k)) / 10);
    for (const m of maskers) {
      const zm = z[m.k];
      const av = m.tonal ? -1.525 - 0.275 * zm - 4.5 : -1.525 - 0.175 * zm - 0.5;
      const lt = m.level + av + spreading(z[k] - zm, m.level);
      if (lt > -50) sum += 10 ** (lt / 10);
    }
    threshold[k] = 10 * Math.log10(sum);
  }

  // SMR por subbanda: nivel máximo de la señal menos el umbral mínimo de la banda.
  const perBand = half / BANDS;
  const smr = new Float64Array(BANDS);
  for (let sb = 0; sb < BANDS; sb++) {
    let lmax = -Infinity;
    let tmin = Infinity;
    for (let k = sb * perBand; k < (sb + 1) * perBand; k++) {
      lmax = Math.max(lmax, P[k]);
      tmin = Math.min(tmin, threshold[k]);
    }
    smr[sb] = lmax - tmin;
  }
  return { smr, spectrum: P, threshold };
}

// ─── Codificador ────────────────────────────────────────────────────────────

export interface Mpeg1Stats {
  /** Bits por muestra asignados a cada subbanda, promediados en todas las tramas. */
  avgAlloc: Float64Array;
  /** Trama de más energía, para dibujar espectro frente a umbral. */
  sample: PsychoResult | null;
}

export function mpeg1Encode(
  x: Float32Array,
  fs: number,
  bitrate: number,
  usePsycho: boolean,
): { writer: BitWriter; stats: Mpeg1Stats; frames: number } {
  const coeffs = analysis(x);
  const frames = Math.ceil(coeffs.length / SAMPLES_PER_BAND);
  const bitsPerFrame = Math.floor((bitrate * FRAME) / fs);
  const w = new BitWriter();
  const avgAlloc = new Float64Array(BANDS);
  let sample: PsychoResult | null = null;
  let bestEnergy = -1;

  for (let f = 0; f < frames; f++) {
    // Las 12 muestras de cada subbanda de esta trama.
    const sub = Array.from({ length: BANDS }, (_, sb) =>
      Float64Array.from(
        { length: SAMPLES_PER_BAND },
        (_, j) => coeffs[f * SAMPLES_PER_BAND + j]?.[sb] ?? 0,
      ),
    );
    const scf = sub.map((s) => {
      const peak = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      let i = 62;
      while (i > 0 && SCALE_FACTORS[i] < peak) i--;
      return i;
    });

    // SMR: con el modelo psicoacústico, o solo con el nivel de la señal (para comparar).
    let smr: Float64Array;
    if (usePsycho) {
      const pa = psychoacoustic(x, f * FRAME, fs);
      smr = pa.smr;
      const energy = pa.spectrum.reduce((s, v) => s + 10 ** (v / 10), 0);
      if (energy > bestEnergy) {
        bestEnergy = energy;
        sample = pa;
      }
    } else {
      smr = Float64Array.from(scf, (i) => 20 * Math.log10(SCALE_FACTORS[i]) + 90);
    }

    const alloc = allocate(smr, bitsPerFrame - HEADER_BITS - BANDS * ALLOC_BITS);
    w.write(0xfff, 12); // sincronismo
    w.write(Math.round(bitrate / 1000), 20); // resto de la cabecera (tasa en kbps)
    alloc.forEach((b) => w.write(b === 0 ? 0 : b - 1, ALLOC_BITS));
    alloc.forEach((b, sb) => b && w.write(scf[sb], SCF_BITS));
    for (let j = 0; j < SAMPLES_PER_BAND; j++) {
      for (let sb = 0; sb < BANDS; sb++) {
        const b = alloc[sb];
        if (!b) continue;
        const levels = 2 ** b - 1;
        const v = Math.max(-1, Math.min(1, sub[sb][j] / SCALE_FACTORS[scf[sb]]));
        w.write(Math.round(((v + 1) / 2) * (levels - 1)), b);
      }
    }
    // Relleno hasta el tamaño de trama (tasa constante).
    const used = w.bitLength - f * bitsPerFrame;
    for (let i = used; i < bitsPerFrame; i++) w.writeBit(0);
    alloc.forEach((b, sb) => (avgAlloc[sb] += b / frames));
  }
  return { writer: w, stats: { avgAlloc, sample }, frames };
}

/**
 * Reparte los bits: en cada paso sube los bits de la subbanda con menor
 * relación ruido/máscara (MNR = SNR(b) − SMR), si cabe en lo que queda.
 */
export function allocate(smr: Float64Array, available: number): number[] {
  const bits = new Array<number>(BANDS).fill(0);
  let left = available;
  for (;;) {
    let best = -1;
    let bestMnr = Infinity;
    let bestCost = 0;
    for (let sb = 0; sb < BANDS; sb++) {
      const b = bits[sb];
      if (b >= 15) continue;
      // Pasar de 0 a 2 bits cuesta además el factor de escala.
      const cost = b === 0 ? SCF_BITS + 2 * SAMPLES_PER_BAND : SAMPLES_PER_BAND;
      if (cost > left) continue;
      const mnr = SNR_TABLE[b] - smr[sb];
      if (mnr < bestMnr) {
        bestMnr = mnr;
        best = sb;
        bestCost = cost;
      }
    }
    if (best < 0) break;
    bits[best] = bits[best] === 0 ? 2 : bits[best] + 1;
    left -= bestCost;
  }
  return bits;
}

// ─── Piezas sueltas (para el interior didáctico del códec) ──────────────────

/** Bits disponibles para muestras y factores de escala en cada trama. */
export const availableBits = (bitrate: number, fs: number) =>
  Math.floor((bitrate * FRAME) / fs) - HEADER_BITS - BANDS * ALLOC_BITS;

/** Índice del menor factor de escala que cubre el pico. */
export function scaleFactorIndex(peak: number): number {
  let i = 62;
  while (i > 0 && SCALE_FACTORS[i] < peak) i--;
  return i;
}

/** Cuantiza y reconstruye una muestra de subbanda igual que codificador + decodificador. */
export function quantizeSubbandSample(v: number, bits: number, scf: number): number {
  if (!bits) return 0;
  const levels = 2 ** bits - 1;
  const sf = SCALE_FACTORS[scf];
  const code = Math.min(
    levels - 1,
    Math.round(((Math.max(-1, Math.min(1, v / sf)) + 1) / 2) * (levels - 1)),
  );
  return ((2 * code) / (levels - 1) - 1) * sf;
}

export const SUBBAND_SAMPLES = SAMPLES_PER_BAND;

// ─── Decodificador ──────────────────────────────────────────────────────────

export function mpeg1Decode(
  bytes: Uint8Array,
  bitLength: number,
  n: number,
  fs: number,
  bitrate: number,
): Float32Array {
  const bitsPerFrame = Math.floor((bitrate * FRAME) / fs);
  const frames = Math.floor(bitLength / bitsPerFrame);
  const blocks: Float64Array[] = [];
  const r = new BitReader(bytes, bitLength);
  for (let f = 0; f < frames; f++) {
    const startRemaining = r.remaining;
    r.read(HEADER_BITS);
    const alloc = Array.from({ length: BANDS }, () => {
      const a = r.read(ALLOC_BITS);
      return a === 0 ? 0 : a + 1;
    });
    const scf = alloc.map((b) => (b ? Math.min(62, r.read(SCF_BITS)) : 0));
    for (let j = 0; j < SAMPLES_PER_BAND; j++) {
      const c = new Float64Array(BANDS);
      for (let sb = 0; sb < BANDS; sb++) {
        const b = alloc[sb];
        if (!b) continue;
        const levels = 2 ** b - 1;
        const code = Math.min(levels - 1, r.read(b));
        c[sb] = ((2 * code) / (levels - 1) - 1) * SCALE_FACTORS[scf[sb]];
      }
      blocks.push(c);
    }
    // Salta el relleno hasta el final de la trama (tasa constante).
    for (
      let pad = bitsPerFrame - (startRemaining - r.remaining);
      pad > 0;
      pad -= Math.min(32, pad)
    ) {
      r.read(Math.min(32, pad));
    }
  }
  return synthesis(blocks, n);
}

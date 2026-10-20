import { autocorrelation, levinson } from './lpc';

/** Ventana de Hamming. */
export function hamming(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / Math.max(1, n - 1));
  return w;
}

/** Copia un trozo de `x` empezando en `start`, rellenando con ceros fuera de rango. */
export function frameAt(x: Float32Array, start: number, length: number): Float64Array {
  const f = new Float64Array(length);
  for (let i = 0; i < length; i++) f[i] = x[start + i] ?? 0;
  return f;
}

export interface PitchResult {
  voiced: boolean;
  /** Periodo en muestras (0 si es sorda). */
  lag: number;
  /** Pico normalizado de la autocorrelación (0…1). */
  strength: number;
}

/**
 * Detector de tono clásico: recorte central al 30 % y autocorrelación en el
 * rango de tonos de la voz.
 */
export function detectPitch(
  frame: ArrayLike<number>,
  fs: number,
  opts: { minHz?: number; maxHz?: number; threshold?: number; silence?: number } = {},
): PitchResult {
  const minLag = Math.floor(fs / (opts.maxHz ?? 400));
  const maxLag = Math.min(frame.length - 1, Math.ceil(fs / (opts.minHz ?? 60)));
  let peak = 0;
  let energy = 0;
  for (let i = 0; i < frame.length; i++) {
    peak = Math.max(peak, Math.abs(frame[i]));
    energy += frame[i] * frame[i];
  }
  if (Math.sqrt(energy / frame.length) < (opts.silence ?? 2e-3) || maxLag <= minLag) {
    return { voiced: false, lag: 0, strength: 0 };
  }
  const cl = 0.3 * peak;
  const c = Float64Array.from(frame, (v) => (v > cl ? v - cl : v < -cl ? v + cl : 0));
  let r0 = 0;
  for (let i = 0; i < c.length; i++) r0 += c[i] * c[i];
  if (r0 === 0) return { voiced: false, lag: 0, strength: 0 };
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0;
    for (let i = lag; i < c.length; i++) r += c[i] * c[i - lag];
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  const strength = best / r0;
  return { voiced: strength > (opts.threshold ?? 0.3), lag: bestLag, strength };
}

/** Predictor LPC de una trama enventanada (método de autocorrelación). */
export function lpcFrame(frame: Float64Array, order: number): { a: Float64Array; k: Float64Array } {
  const w = hamming(frame.length);
  const xw = frame.map((v, i) => v * w[i]);
  const r = autocorrelation(xw, order);
  r[0] *= 1 + 1e-9; // ruido blanco mínimo: evita matrices singulares en silencio
  const { a, k } = levinson(r, order);
  return { a: Float64Array.from(a), k: Float64Array.from(k) };
}

/** Coeficientes de reflexión → predictor (recursión "step-up"). */
export function reflectionToLpc(k: ArrayLike<number>): Float64Array {
  let a = new Float64Array(0);
  for (let i = 0; i < k.length; i++) {
    const next = new Float64Array(i + 1);
    next[i] = k[i];
    for (let j = 0; j < i; j++) next[j] = a[j] - k[i] * a[i - 1 - j];
    a = next;
  }
  return a;
}

/** Filtro de síntesis 1/A(z) con memoria: y[n] = e[n] + Σ a_k·y[n−k]. */
export class SynthesisFilter {
  private mem: Float64Array;
  constructor(order: number) {
    this.mem = new Float64Array(order);
  }
  process(e: number, a: ArrayLike<number>): number {
    let y = e;
    for (let k = 0; k < a.length; k++) y += a[k] * this.mem[k];
    this.mem.copyWithin(1, 0);
    this.mem[0] = y;
    return y;
  }
}

/** Error de predicción (residuo) de una trama usando las muestras anteriores reales. */
export function residualRms(
  x: Float32Array,
  start: number,
  length: number,
  a: ArrayLike<number>,
): number {
  let s = 0;
  for (let n = start; n < start + length; n++) {
    let e = x[n] ?? 0;
    for (let k = 0; k < a.length; k++) e -= a[k] * (x[n - 1 - k] ?? 0);
    s += e * e;
  }
  return Math.sqrt(s / length);
}

/** Respuesta en magnitud (dB) de G/A(z) en `points` frecuencias de 0 a fs/2. */
export function lpcEnvelopeDb(a: ArrayLike<number>, gain: number, points = 128): Float32Array {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const w = (Math.PI * i) / (points - 1);
    let re = 1;
    let im = 0;
    for (let k = 0; k < a.length; k++) {
      re -= a[k] * Math.cos(w * (k + 1));
      im += a[k] * Math.sin(w * (k + 1));
    }
    out[i] = 20 * Math.log10(gain / Math.sqrt(re * re + im * im) + 1e-12);
  }
  return out;
}

/** Espectro en dB de una trama (con ventana de Hamming y FFT directa pequeña). */
export function frameSpectrumDb(frame: Float64Array, points = 128): Float32Array {
  const w = hamming(frame.length);
  let wsum = 0;
  for (const v of w) wsum += v * v;
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const om = (Math.PI * i) / (points - 1);
    let re = 0;
    let im = 0;
    for (let n = 0; n < frame.length; n++) {
      re += frame[n] * w[n] * Math.cos(om * n);
      im -= frame[n] * w[n] * Math.sin(om * n);
    }
    out[i] = 10 * Math.log10((re * re + im * im) / wsum + 1e-12);
  }
  return out;
}

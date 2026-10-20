import { BitReader, BitWriter } from '@/engine/dsp/bits';
import { convolveCausal } from '@/engine/dsp/filters';

/**
 * Códec de subbandas con la estructura de G.722: un banco QMF de 2 bandas
 * divide la señal en mitad baja (0…fs/4) y mitad alta (fs/4…fs/2), cada una
 * a la mitad de frecuencia de muestreo, y cada banda se codifica con su
 * propio ADPCM. La banda baja (donde está casi toda la energía de la voz)
 * recibe más bits que la alta. No es compatible bit a bit con G.722: su
 * ADPCM es más sencillo (predictor fijo y paso adaptativo de Jayant).
 */
// El QMF clásico necesita un filtro de fase lineal con longitud PAR: así la
// banda alta vuelve con el signo correcto y se suma (no se resta) a la baja.
export const QMF_TAPS = 48;
const H0 = designQmf(QMF_TAPS);
const H1 = H0.map((v, n) => (n % 2 ? -v : v));
/** Retardo total de análisis + síntesis (muestras). Se compensa al final. */
const DELAY = QMF_TAPS - 1;
/** Muestras de cada banda para una señal de `n` muestras. */
export const bandLength = (n: number) => Math.ceil((n + DELAY) / 2);

export function qmfSplit(x: Float32Array): { low: Float32Array; high: Float32Array } {
  // Se rellena con ceros para que la cola de los filtros también se codifique.
  const padded = new Float32Array(x.length + DELAY);
  padded.set(x);
  const lo = convolveCausal(padded, H0);
  const hi = convolveCausal(padded, H1);
  const n = bandLength(x.length);
  return {
    low: Float32Array.from({ length: n }, (_, i) => lo[2 * i]),
    high: Float32Array.from({ length: n }, (_, i) => hi[2 * i]),
  };
}

export function qmfMerge(low: Float32Array, high: Float32Array, length: number): Float32Array {
  const total = length + DELAY;
  const ul = new Float32Array(total);
  const uh = new Float32Array(total);
  for (let i = 0; i < low.length && 2 * i < total; i++) {
    ul[2 * i] = low[i];
    uh[2 * i] = high[i];
  }
  // Síntesis QMF: F0 = 2·H0 y F1 = −2·H1 cancelan el aliasing entre bandas.
  const a = convolveCausal(ul, H0);
  const b = convolveCausal(uh, H1);
  // Se descuenta el retardo de los filtros para que salida y entrada queden alineadas.
  return Float32Array.from({ length }, (_, i) => 2 * (a[i + DELAY] - b[i + DELAY]));
}

// ─── ADPCM con paso adaptativo de Jayant ────────────────────────────────────

interface BandState {
  pred: number;
  step: number;
}

function multiplier(mag: number, levels: number): number {
  // Códigos pequeños encogen el paso; los grandes lo agrandan (Jayant). Con
  // más niveles, el código máximo indica un salto mayor y el paso crece más
  // deprisa, para seguir los ataques bruscos (los pulsos glotales de la voz).
  if (levels === 1) return 1;
  const r = mag / (levels - 1);
  return r < 0.5 ? 0.92 : 0.92 + (r - 0.5) * 2 * (0.8 + 0.12 * levels);
}

function quantizeSample(
  x: number,
  bits: number,
  s: BandState,
  a1: number,
): { code: number; rec: number } {
  const levels = 2 ** (bits - 1);
  const pred = a1 * s.pred;
  const e = x - pred;
  const mag = Math.min(levels - 1, Math.floor(Math.abs(e) / s.step));
  const sign = e < 0 ? 1 : 0;
  return {
    code: (sign << (bits - 1)) | mag,
    rec: reconstruct((sign << (bits - 1)) | mag, bits, s, a1),
  };
}

function reconstruct(code: number, bits: number, s: BandState, a1: number): number {
  const levels = 2 ** (bits - 1);
  const mag = code & (levels - 1);
  const sign = code >> (bits - 1) ? -1 : 1;
  const rec = Math.max(-2, Math.min(2, a1 * s.pred + sign * (mag + 0.5) * s.step));
  s.pred = rec;
  s.step = Math.max(1e-5, Math.min(1, s.step * multiplier(mag, levels)));
  return rec;
}

const A_LOW = 0.9;
const A_HIGH = 0;

export function subbandEncode(x: Float32Array, lowBits: number, highBits: number) {
  const { low, high } = qmfSplit(x);
  const w = new BitWriter();
  const sl: BandState = { pred: 0, step: 0.01 };
  const sh: BandState = { pred: 0, step: 0.01 };
  const recL = new Float32Array(low.length);
  const recH = new Float32Array(high.length);
  let el = 0;
  let eh = 0;
  for (let i = 0; i < low.length; i++) {
    const ql = quantizeSample(low[i], lowBits, sl, A_LOW);
    const qh = quantizeSample(high[i], highBits, sh, A_HIGH);
    w.write(ql.code, lowBits);
    w.write(qh.code, highBits);
    recL[i] = ql.rec;
    recH[i] = qh.rec;
    el += low[i] * low[i];
    eh += high[i] * high[i];
  }
  return {
    writer: w,
    reconstructed: qmfMerge(recL, recH, x.length),
    lowEnergyPct: (100 * el) / Math.max(1e-20, el + eh),
  };
}

export function subbandDecode(
  bytes: Uint8Array,
  bitLength: number,
  n: number,
  lowBits: number,
  highBits: number,
) {
  const r = new BitReader(bytes, bitLength);
  const half = bandLength(n);
  const sl: BandState = { pred: 0, step: 0.01 };
  const sh: BandState = { pred: 0, step: 0.01 };
  const low = new Float32Array(half);
  const high = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    low[i] = reconstruct(r.read(lowBits), lowBits, sl, A_LOW);
    high[i] = reconstruct(r.read(highBits), highBits, sh, A_HIGH);
  }
  return qmfMerge(low, high, n);
}

// ─── Diseño del filtro prototipo ────────────────────────────────────────────

/**
 * Busca el paso bajo (sinc con ventana de Kaiser) que hace |H0|² + |H1|² lo
 * más plano posible: es la condición para que el QMF casi reconstruya la
 * señal (la idea de los filtros de Johnston). Se calcula una vez al cargar.
 */
function designQmf(taps: number): Float64Array {
  let best: Float64Array = new Float64Array(taps);
  let bestErr = Infinity;
  for (let beta = 3; beta <= 9; beta += 0.5) {
    for (let fc = 0.235; fc <= 0.265; fc += 0.0005) {
      const h = kaiserSinc(taps, fc, beta);
      const err = flatnessError(h);
      if (err < bestErr) {
        bestErr = err;
        best = h;
      }
    }
  }
  return best;
}

function kaiserSinc(taps: number, fc: number, beta: number): Float64Array {
  const m = (taps - 1) / 2;
  const h = new Float64Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const t = i - m;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    h[i] = (sinc * besselI0(beta * Math.sqrt(1 - (t / m) ** 2))) / besselI0(beta);
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

function besselI0(x: number): number {
  let s = 1;
  let term = 1;
  for (let k = 1; k < 30; k++) {
    term *= (x / (2 * k)) ** 2;
    s += term;
  }
  return s;
}

/** Máxima desviación de |H0(ω)|² + |H0(ω+π)|² respecto de 1, más el rechazo en la banda eliminada. */
function flatnessError(h: Float64Array): number {
  const mag2 = (w: number) => {
    let re = 0;
    let im = 0;
    for (let k = 0; k < h.length; k++) {
      re += h[k] * Math.cos(w * k);
      im -= h[k] * Math.sin(w * k);
    }
    return re * re + im * im;
  };
  let err = 0;
  for (let i = 0; i <= 64; i++) {
    const w = (Math.PI * i) / 128;
    err = Math.max(err, Math.abs(mag2(w) + mag2(w + Math.PI) - 1));
  }
  // Que además separe las bandas: poca ganancia lejos de la transición.
  return err + Math.sqrt(mag2(0.75 * Math.PI));
}

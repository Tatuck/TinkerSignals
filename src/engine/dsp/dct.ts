import { fft } from './fft';

/**
 * DCT-II y DCT-III ortonormales. Para longitudes potencia de 2 se usan con
 * una FFT de N puntos (algoritmo de Makhoul): O(N log N). Para el resto,
 * la fórmula directa O(N²).
 */
const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
const scale = (k: number, n: number) => Math.sqrt((k === 0 ? 1 : 2) / n);

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();
function twiddle(n: number) {
  let t = twiddles.get(n);
  if (!t) {
    t = {
      cos: Float64Array.from({ length: n }, (_, k) => Math.cos((Math.PI * k) / (2 * n))),
      sin: Float64Array.from({ length: n }, (_, k) => Math.sin((Math.PI * k) / (2 * n))),
    };
    twiddles.set(n, t);
  }
  return t;
}

export function dct(x: ArrayLike<number>, out = new Float64Array(x.length)): Float64Array {
  const n = x.length;
  if (!isPow2(n) || n < 4) return dctDirect(x, out);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n / 2; i++) {
    re[i] = x[2 * i];
    re[n - 1 - i] = x[2 * i + 1];
  }
  fft(re, im);
  const { cos, sin } = twiddle(n);
  for (let k = 0; k < n; k++) out[k] = (re[k] * cos[k] + im[k] * sin[k]) * scale(k, n);
  return out;
}

export function idct(X: ArrayLike<number>, out = new Float64Array(X.length)): Float64Array {
  const n = X.length;
  if (!isPow2(n) || n < 4) return idctDirect(X, out);
  const { cos, sin } = twiddle(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    // V[k] = e^{iπk/2N}·(C[k] − i·C[N−k]), con C sin normalizar.
    const c = X[k] / scale(k, n);
    const cr = k === 0 ? 0 : X[n - k] / scale(n - k, n);
    re[k] = c * cos[k] + cr * sin[k];
    im[k] = c * sin[k] - cr * cos[k];
  }
  // IFFT a partir de la FFT: conjugar, transformar, conjugar y dividir por N.
  for (let k = 0; k < n; k++) im[k] = -im[k];
  fft(re, im);
  for (let i = 0; i < n / 2; i++) {
    out[2 * i] = re[i] / n;
    out[2 * i + 1] = re[n - 1 - i] / n;
  }
  return out;
}

function dctDirect(x: ArrayLike<number>, out: Float64Array): Float64Array {
  const n = x.length;
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += x[i] * Math.cos((Math.PI * (i + 0.5) * k) / n);
    out[k] = s * scale(k, n);
  }
  return out;
}

function idctDirect(X: ArrayLike<number>, out: Float64Array): Float64Array {
  const n = X.length;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += X[k] * scale(k, n) * Math.cos((Math.PI * (i + 0.5) * k) / n);
    out[i] = s;
  }
  return out;
}

export const __test = { dctDirect, idctDirect };

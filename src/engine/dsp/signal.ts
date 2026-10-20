import type { Signal } from '../types';

export function makeSignal(samples: Float32Array, sampleRate: number): Signal {
  return { kind: 'signal', samples, sampleRate };
}

/** Envolvente min/max en `bins` columnas: miniatura fiel de cualquier señal larga. */
export function envelope(x: Float32Array, bins: number): { min: Float32Array; max: Float32Array } {
  const n = Math.max(1, Math.min(bins, x.length));
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    const a = Math.floor((b * x.length) / n);
    const z = Math.max(a + 1, Math.floor(((b + 1) * x.length) / n));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = a; i < z && i < x.length; i++) {
      if (x[i] < lo) lo = x[i];
      if (x[i] > hi) hi = x[i];
    }
    min[b] = lo === Infinity ? 0 : lo;
    max[b] = hi === -Infinity ? 0 : hi;
  }
  return { min, max };
}

/**
 * Elige un trozo corto e interesante (la zona de más energía) para las
 * gráficas didácticas de entrada vs salida: con unos pocos ms se ve bien
 * la forma de onda y la diferencia entre ambas.
 */
export function interestingWindow(x: Float32Array, length: number): [number, number] {
  if (x.length <= length) return [0, x.length];
  const hop = Math.max(1, Math.floor(length / 2));
  let best = 0;
  let bestE = -1;
  for (let s = 0; s + length <= x.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + length; i += 4) e += x[i] * x[i];
    if (e > bestE) {
      bestE = e;
      best = s;
    }
  }
  return [best, best + length];
}

/** Recorte de una ventana [a, b) como array normal (para gráficas). */
export function slice(x: Float32Array, [a, b]: [number, number]): Float32Array {
  return x.slice(a, b);
}

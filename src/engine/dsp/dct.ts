/** DCT-II ortonormal de un bloque (directa, O(N²): los bloques son pequeños). */
export function dct(x: ArrayLike<number>, out = new Float64Array(x.length)): Float64Array {
  const n = x.length;
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += x[i] * Math.cos((Math.PI * (i + 0.5) * k) / n);
    out[k] = s * Math.sqrt((k === 0 ? 1 : 2) / n);
  }
  return out;
}

/** DCT-III ortonormal: inversa de `dct`. */
export function idct(X: ArrayLike<number>, out = new Float64Array(X.length)): Float64Array {
  const n = X.length;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += X[k] * Math.sqrt((k === 0 ? 1 : 2) / n) * Math.cos((Math.PI * (i + 0.5) * k) / n);
    out[i] = s;
  }
  return out;
}

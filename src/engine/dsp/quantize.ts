/**
 * Índice de cuantización uniforme de `x` ∈ [-1, 1] con 2^bits niveles.
 *  - midrise: no hay nivel en 0 (escalones en ±Δ/2, ±3Δ/2…). Índices 0…L-1.
 *  - midtread: hay nivel en 0. Índices -L/2…L/2-1.
 */
export function uniformIndex(x: number, bits: number, mode: 'midrise' | 'midtread'): number {
  const L = 2 ** bits;
  const delta = 2 / L;
  if (mode === 'midrise') {
    return Math.min(L - 1, Math.max(0, Math.floor((x + 1) / delta)));
  }
  return Math.min(L / 2 - 1, Math.max(-L / 2, Math.round(x / delta)));
}

/** Valor reconstruido a partir del índice. */
export function uniformValue(index: number, bits: number, mode: 'midrise' | 'midtread'): number {
  const delta = 2 / 2 ** bits;
  return mode === 'midrise' ? -1 + (index + 0.5) * delta : index * delta;
}

export function quantizeUniform(
  x: Float32Array,
  bits: number,
  mode: 'midrise' | 'midtread',
): Float32Array {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++)
    y[i] = uniformValue(uniformIndex(x[i], bits, mode), bits, mode);
  return y;
}

/**
 * Cuantizador simétrico mid-tread con 2ⁿ − 1 niveles en [−escala, escala]
 * (cero incluido). Con un número impar de niveles, el valor máximo cae
 * justo en un nivel y no en la frontera entre dos. Con 1 bit solo queda el
 * signo: ±escala.
 */
export function quantizeSymmetric(v: number, scale: number, bits: number): number {
  if (scale <= 0) return 0;
  if (bits <= 1) return v === 0 ? 0 : Math.sign(v) * scale;
  const half = 2 ** (bits - 1) - 1; // niveles a cada lado del cero
  const q = Math.max(-half, Math.min(half, Math.round((v / scale) * half)));
  return (q / half) * scale;
}

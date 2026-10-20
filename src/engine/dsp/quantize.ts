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
  for (let i = 0; i < x.length; i++) y[i] = uniformValue(uniformIndex(x[i], bits, mode), bits, mode);
  return y;
}

/**
 * Leyes de compresión-expansión de G.711. Comprimen la amplitud antes de un
 * cuantizador uniforme para que las señales débiles tengan escalones más
 * finos: SNR casi constante en un rango dinámico grande.
 */
export type Law = 'linear' | 'mu' | 'a';

export function compress(x: number, law: Law, mu = 255, A = 87.6): number {
  const s = Math.sign(x);
  const ax = Math.min(1, Math.abs(x));
  if (law === 'mu') return (s * Math.log1p(mu * ax)) / Math.log1p(mu);
  if (law === 'a') {
    const d = 1 + Math.log(A);
    return s * (ax < 1 / A ? (A * ax) / d : (1 + Math.log(A * ax)) / d);
  }
  return x;
}

export function expand(y: number, law: Law, mu = 255, A = 87.6): number {
  const s = Math.sign(y);
  const ay = Math.min(1, Math.abs(y));
  if (law === 'mu') return (s * (Math.pow(1 + mu, ay) - 1)) / mu;
  if (law === 'a') {
    const d = 1 + Math.log(A);
    return s * (ay < 1 / d ? (ay * d) / A : Math.exp(ay * d - 1) / A);
  }
  return y;
}

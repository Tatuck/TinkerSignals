/** Autocorrelación r[0..order] de x (sesgada, como `xcorr(...,'biased')` de MATLAB). */
export function autocorrelation(
  x: ArrayLike<number>,
  order: number,
  start = 0,
  length = x.length,
): Float64Array {
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let s = 0;
    for (let i = start + k; i < start + length; i++) s += x[i] * x[i - k];
    r[k] = s / length;
  }
  return r;
}

/**
 * Levinson-Durbin.
 * Devuelve los coeficientes a[1..p] del predictor x̂[n] = Σ a_k·x[n−k],
 * los coeficientes de reflexión y el error de predicción final.
 */
export function levinson(
  r: ArrayLike<number>,
  order: number,
): { a: Float64Array; k: Float64Array; error: number } {
  const a = new Float64Array(order + 1);
  const k = new Float64Array(order + 1);
  let err = r[0];
  if (err <= 0) return { a: a.subarray(1), k: k.subarray(1), error: 0 };
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc -= a[j] * r[i - j];
    const ki = acc / err;
    k[i] = ki;
    const prev = a.slice();
    a[i] = ki;
    for (let j = 1; j < i; j++) a[j] = prev[j] - ki * prev[i - j];
    err *= 1 - ki * ki;
  }
  return { a: a.subarray(1), k: k.subarray(1), error: err };
}

/** Filtro FIR paso bajo por ventana (sinc enventanada con Hamming). `fc` relativa a fs (0…0,5). */
export function lowpassFir(fc: number, taps: number): Float64Array {
  const h = new Float64Array(taps);
  const m = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const t = i - m;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    h[i] = sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1)));
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

/** Convolución "same" (centrada): la salida queda alineada con la entrada. */
export function convolveSame(x: Float32Array, h: ArrayLike<number>): Float32Array {
  const y = new Float32Array(x.length);
  const m = Math.floor(h.length / 2);
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (let k = 0; k < h.length; k++) {
      const i = n + m - k;
      if (i >= 0 && i < x.length) s += h[k] * x[i];
    }
    y[n] = s;
  }
  return y;
}

/** Coeficientes de un biquad (RBJ Audio EQ Cookbook). */
export function biquad(
  type: 'lowpass' | 'highpass' | 'bandpass',
  f0: number,
  fs: number,
  q = Math.SQRT1_2,
): { b: [number, number, number]; a: [number, number] } {
  const w = (2 * Math.PI * Math.min(f0, fs * 0.49)) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [(-2 * cos) / a0, (1 - alpha) / a0] };
}

export function applyBiquad(x: Float32Array, { b, a }: ReturnType<typeof biquad>): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = b[0] * x[n] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[n]; y2 = y1; y1 = v;
    y[n] = v;
  }
  return y;
}

/** Respuesta en magnitud (dB) de un biquad en `points` frecuencias de 0 a fs/2. */
export function biquadResponseDb(f: ReturnType<typeof biquad>, points = 128): Float32Array {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const w = (Math.PI * i) / (points - 1);
    const re = (c0: number, c1: number, c2: number) => c0 + c1 * Math.cos(-w) + c2 * Math.cos(-2 * w);
    const im = (c1: number, c2: number) => c1 * Math.sin(-w) + c2 * Math.sin(-2 * w);
    const nr = re(f.b[0], f.b[1], f.b[2]);
    const ni = im(f.b[1], f.b[2]);
    const dr = re(1, f.a[0], f.a[1]);
    const di = im(f.a[0], f.a[1]);
    out[i] = 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-12);
  }
  return out;
}

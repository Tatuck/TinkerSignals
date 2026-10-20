/** FFT radix-2 in-place (Cooley–Tukey). `re` e `im` deben tener longitud potencia de 2. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error('La FFT necesita una longitud potencia de 2');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export function nextPow2(n: number): number {
  return 1 << Math.ceil(Math.log2(Math.max(1, n)));
}

export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/**
 * Espectro medio (Welch) en dB: magnitud media de varias ventanas de
 * tamaño `size`. Devuelve `size/2` valores de 0 a fs/2.
 */
export function averageSpectrumDb(x: Float32Array, size = 1024): Float32Array {
  const w = hann(size);
  const half = size / 2;
  const acc = new Float64Array(half);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let frames = 0;
  const hop = size / 2;
  for (let s = 0; s + size <= Math.max(x.length, size); s += hop) {
    for (let i = 0; i < size; i++) {
      re[i] = (x[s + i] ?? 0) * w[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < half; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
    if (frames > 400) break; // suficiente para una vista didáctica
  }
  const out = new Float32Array(half);
  const norm = frames * size * size * 0.25;
  for (let k = 0; k < half; k++) out[k] = 10 * Math.log10(acc[k] / norm + 1e-12);
  return out;
}

/**
 * Espectrograma: matriz [trama][bin] en dB, con `cols` tramas repartidas
 * por toda la señal.
 */
export function spectrogramDb(x: Float32Array, size = 512, cols = 200): Float32Array[] {
  const w = hann(size);
  const half = size / 2;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const out: Float32Array[] = [];
  const step = Math.max(1, (x.length - size) / Math.max(1, cols - 1));
  for (let c = 0; c < cols; c++) {
    const s = Math.floor(c * step);
    for (let i = 0; i < size; i++) {
      re[i] = (x[s + i] ?? 0) * w[i];
      im[i] = 0;
    }
    fft(re, im);
    const col = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      col[k] = 10 * Math.log10((re[k] * re[k] + im[k] * im[k]) / (size * size * 0.25) + 1e-12);
    }
    out.push(col);
  }
  return out;
}

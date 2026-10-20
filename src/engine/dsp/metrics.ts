/** Métricas de calidad y de información. */

/** SNR global en dB entre una referencia y su versión procesada. */
export function snr(reference: Float32Array, processed: Float32Array): number {
  const n = Math.min(reference.length, processed.length);
  let ps = 0;
  let pe = 0;
  for (let i = 0; i < n; i++) {
    ps += reference[i] * reference[i];
    const e = reference[i] - processed[i];
    pe += e * e;
  }
  if (pe === 0) return Infinity;
  if (ps === 0) return -Infinity;
  return 10 * Math.log10(ps / pe);
}

/**
 * SNR segmental: media de la SNR por tramas, ignorando las tramas de
 * silencio. Se parece más a lo que percibe el oído que la SNR global.
 */
export function segmentalSnr(
  reference: Float32Array,
  processed: Float32Array,
  frame = 256,
  silenceDb = -50,
): number {
  const n = Math.min(reference.length, processed.length);
  let sum = 0;
  let count = 0;
  for (let start = 0; start + frame <= n; start += frame) {
    let ps = 0;
    let pe = 0;
    for (let i = start; i < start + frame; i++) {
      ps += reference[i] * reference[i];
      const e = reference[i] - processed[i];
      pe += e * e;
    }
    if (10 * Math.log10(ps / frame + 1e-20) < silenceDb) continue;
    // Recorte típico a [-10, 35] dB para que una trama no domine la media.
    const s = 10 * Math.log10((ps + 1e-20) / (pe + 1e-20));
    sum += Math.min(35, Math.max(-10, s));
    count++;
  }
  return count ? sum / count : NaN;
}

/** Entropía de Shannon (bits/símbolo) de una secuencia de enteros. */
export function entropy(symbols: ArrayLike<number>): number {
  const counts = new Map<number, number>();
  for (let i = 0; i < symbols.length; i++) {
    counts.set(symbols[i], (counts.get(symbols[i]) ?? 0) + 1);
  }
  let h = 0;
  for (const c of counts.values()) {
    const p = c / symbols.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return x.length ? Math.sqrt(s / x.length) : 0;
}

export function peak(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}

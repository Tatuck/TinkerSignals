import { BitReader, BitWriter, readFloat32, writeFloat32 } from '@/engine/dsp/bits';
import { autocorrelation, levinson } from '@/engine/dsp/lpc';
import { uniformIndex, uniformValue } from '@/engine/dsp/quantize';

/**
 * DPCM con predictor lineal.
 * El predictor trabaja en lazo cerrado: predice a partir de la señal
 * *reconstruida*, igual que hará el decodificador, para que el error de
 * cuantización no se acumule.
 *
 * Formato: [orden: 4 bits][coeficientes: orden × float32][rango: float32][códigos: n bits por muestra]
 */
export interface DpcmEncoded {
  writer: BitWriter;
  coeffs: Float64Array;
  error: Float32Array;
  reconstructed: Float32Array;
  sideBits: number;
}

export function dpcmEncode(x: Float32Array, order: number, bits: number): DpcmEncoded {
  const r = autocorrelation(x, order);
  const lpc = levinson(r, order).a;
  const L = 2 ** bits;

  // El codificador elige el predictor (con expansión de ancho de banda γ) y el
  // rango del cuantizador del error probando varias combinaciones en lazo
  // cerrado y quedándose con la de menos error; los manda en la cabecera.
  // Entre los candidatos siempre está el rango «seguro», que nunca recorta:
  //   rango = pico del error en lazo abierto / (1 − Σ|a_k|/L)
  // porque en lazo cerrado el ruido de cuantización vuelve a entrar por el
  // predictor (|e| ≤ |e_abierto| + Σ|a_k|·Δ/2) y, si se recorta, puede diverger.
  // Los coeficientes se redondean a float32: es lo que recibe el decodificador.
  let best = { a: expand(lpc, 0.99), range: 1, mse: Infinity };
  for (const gamma of [0.99, 0.95, 0.9, 0.8, 0.6]) {
    const a = expand(lpc, gamma);
    let pe = 0;
    let peak = 0;
    for (let n = 0; n < x.length; n++) {
      const e = x[n] - predict(x, n, a);
      pe += e * e;
      peak = Math.max(peak, Math.abs(e));
    }
    const sigma = Math.sqrt(pe / Math.max(1, x.length));
    const safe = (1.05 * peak) / Math.max(0.1, 1 - sumAbs(a) / L);
    for (const range of [safe, ...[2, 3, 4, 6, 8, 12].map((k) => k * sigma)]) {
      const r = Math.fround(Math.max(1e-4, range));
      const mse = closedLoopMse(x, a, r, bits);
      if (mse < best.mse) best = { a, range: r, mse };
    }
  }
  const { a, range } = best;

  const w = new BitWriter();
  w.write(order, 4);
  a.forEach((c) => writeFloat32(w, c));
  writeFloat32(w, range);
  const sideBits = w.bitLength;

  const xr = new Float32Array(x.length);
  const e = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    const pred = predict(xr, n, a);
    e[n] = x[n] - pred;
    const idx = uniformIndex(e[n] / range, bits, 'midrise');
    w.write(idx, bits);
    xr[n] = clamp(pred + uniformValue(idx, bits, 'midrise') * range);
  }
  return { writer: w, coeffs: a, error: e, reconstructed: xr, sideBits };
}

export function dpcmDecode(
  bytes: Uint8Array,
  bitLength: number,
  n: number,
  bits: number,
): Float32Array {
  const rd = new BitReader(bytes, bitLength);
  const order = rd.read(4);
  const a = Float64Array.from({ length: order }, () => readFloat32(rd));
  const range = readFloat32(rd);
  const xr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xr[i] = clamp(predict(xr, i, a) + uniformValue(rd.read(bits), bits, 'midrise') * range);
  }
  return xr;
}

const expand = (a: ArrayLike<number>, g: number) =>
  Float64Array.from(a, (c, k) => Math.fround(c * g ** (k + 1)));
const sumAbs = (a: Float64Array) => a.reduce((s, v) => s + Math.abs(v), 0);

/** Error cuadrático medio de un DPCM en lazo cerrado con este predictor y rango. */
function closedLoopMse(x: Float32Array, a: Float64Array, range: number, bits: number): number {
  const xr = new Float32Array(x.length);
  let mse = 0;
  for (let n = 0; n < x.length; n++) {
    const pred = predict(xr, n, a);
    xr[n] = clamp(
      pred +
        uniformValue(uniformIndex((x[n] - pred) / range, bits, 'midrise'), bits, 'midrise') * range,
    );
    const d = x[n] - xr[n];
    mse += d * d;
  }
  return mse / Math.max(1, x.length);
}

/** Recorte común a codificador y decodificador: evita que un error de canal haga diverger el predictor. */
const clamp = (v: number) => Math.max(-2, Math.min(2, v));

function predict(xr: Float32Array, n: number, a: ArrayLike<number>): number {
  let p = 0;
  for (let k = 0; k < a.length && n - 1 - k >= 0; k++) p += a[k] * xr[n - 1 - k];
  return p;
}

import type { Image, ImagePlane } from '../types';
import { dct, idct } from './dct';

/**
 * Matemáticas de imagen compartidas: planos, espacios de color, submuestreo,
 * DCT por bloques y medidas de calidad. Los píxeles van de 0 a 255.
 */

export const makePlane = (width: number, height: number, data?: Float32Array): ImagePlane => ({
  width,
  height,
  data: data ?? new Float32Array(width * height),
});

export function makeImage(
  planes: ImagePlane[],
  color: Image['color'],
  domain: Image['domain'] = 'pixels',
  blockSize?: number,
): Image {
  const first = planes[0];
  return {
    kind: 'image',
    width: first.crop?.width ?? first.width,
    height: first.crop?.height ?? first.height,
    color,
    domain,
    planes,
    ...(blockSize ? { blockSize } : {}),
  };
}

export const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Copia de una imagen con los planos clonados (para modificarla sin tocar la original). */
export const cloneImage = (img: Image): Image => ({
  ...img,
  planes: img.planes.map((p) => ({ ...p, data: p.data.slice() })),
});

export function expectPixels(img: Image, blockName: string): void {
  if (img.domain !== 'pixels') {
    throw new Error(
      `${blockName} trabaja con píxeles y le llegan coeficientes DCT. Pon antes una DCT inversa.`,
    );
  }
}

// ─── Espacios de color (JFIF, el que usa JPEG) ──────────────────────────────

export function rgbToYcbcr(r: number, g: number, b: number): [number, number, number] {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  ];
}

export function ycbcrToRgb(y: number, cb: number, cr: number): [number, number, number] {
  return [
    y + 1.402 * (cr - 128),
    y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128),
    y + 1.772 * (cb - 128),
  ];
}

/** Planos a tamaño completo (la crominancia submuestreada se repite). */
function fullPlanes(img: Image): Float32Array[] {
  return img.planes.map((p) =>
    p.width === img.width && p.height === img.height
      ? p.data
      : resamplePlane(p, img.width, img.height).data,
  );
}

/** Convierte una imagen de píxeles a otro espacio de color. */
export function convertColor(img: Image, to: Image['color']): Image {
  if (img.color === to) return img;
  const n = img.width * img.height;
  const src = fullPlanes(img);
  const out = to === 'gray' ? [new Float32Array(n)] : [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    let r: number, g: number, b: number;
    if (img.color === 'gray') r = g = b = src[0][i];
    else if (img.color === 'rgb') [r, g, b] = [src[0][i], src[1][i], src[2][i]];
    else [r, g, b] = ycbcrToRgb(src[0][i], src[1][i], src[2][i]);
    if (to === 'gray') out[0][i] = img.color === 'ycbcr' ? src[0][i] : rgbToYcbcr(r, g, b)[0];
    else if (to === 'rgb') [out[0][i], out[1][i], out[2][i]] = [r, g, b].map(clamp255);
    else [out[0][i], out[1][i], out[2][i]] = rgbToYcbcr(r, g, b);
  }
  return makeImage(
    out.map((d) => makePlane(img.width, img.height, d)),
    to,
  );
}

// ─── Cambio de tamaño de un plano ───────────────────────────────────────────

/**
 * Cambia el tamaño de un plano. Al reducir hace la media de cada zona (como
 * el submuestreo de crominancia); al ampliar repite cada valor.
 */
export function resamplePlane(p: ImagePlane, width: number, height: number): ImagePlane {
  const out = makePlane(width, height);
  const sx = p.width / width;
  const sy = p.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.min(p.height, Math.floor((y + 1) * sy)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.min(p.width, Math.floor((x + 1) * sx)));
      let s = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) s += p.data[Math.min(yy, p.height - 1) * p.width + xx];
      out.data[y * width + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/** Factores de submuestreo de crominancia (horizontal, vertical). */
export const SUBSAMPLING = {
  '4:4:4': [1, 1],
  '4:2:2': [2, 1],
  '4:2:0': [2, 2],
  '4:1:1': [4, 1],
} as const;
export type Subsampling = keyof typeof SUBSAMPLING;

/** Nombre del submuestreo que tiene una imagen YCbCr, si es uno de los conocidos. */
export function subsamplingOf(img: Image): string | undefined {
  if (img.color !== 'ycbcr') return undefined;
  const c = img.planes[1];
  const w = c.crop?.width ?? c.width;
  const h = c.crop?.height ?? c.height;
  for (const [name, [fx, fy]] of Object.entries(SUBSAMPLING))
    if (w === Math.ceil(img.width / fx) && h === Math.ceil(img.height / fy)) return name;
  return undefined;
}

// ─── DCT bidimensional por bloques ──────────────────────────────────────────

/** DCT 2D ortonormal de un bloque n×n (la misma que define JPEG para n = 8). */
export function dct2(block: Float64Array, n: number): Float64Array {
  const tmp = new Float64Array(n * n);
  const row = new Float64Array(n);
  const res = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    dct(block.subarray(y * n, y * n + n), res);
    tmp.set(res, y * n);
  }
  const out = new Float64Array(n * n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) row[y] = tmp[y * n + x];
    dct(row, res);
    for (let y = 0; y < n; y++) out[y * n + x] = res[y];
  }
  return out;
}

export function idct2(coefs: Float64Array, n: number): Float64Array {
  const tmp = new Float64Array(n * n);
  const col = new Float64Array(n);
  const res = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) col[y] = coefs[y * n + x];
    idct(col, res);
    for (let y = 0; y < n; y++) tmp[y * n + x] = res[y];
  }
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    idct(tmp.subarray(y * n, y * n + n), res);
    out.set(res, y * n);
  }
  return out;
}

/** Copia el bloque (bx, by) de un plano, repitiendo el borde si se sale. */
export function readBlock(p: ImagePlane, bx: number, by: number, n: number, offset = 0) {
  const b = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    const yy = Math.min(p.height - 1, by * n + y);
    for (let x = 0; x < n; x++) {
      const xx = Math.min(p.width - 1, bx * n + x);
      b[y * n + x] = p.data[yy * p.width + xx] - offset;
    }
  }
  return b;
}

/**
 * DCT por bloques de un plano. El resultado se rellena hasta un múltiplo de n
 * y recuerda en `crop` el tamaño original. A los píxeles se les resta 128
 * antes (como en JPEG) para que la DC quede centrada en 0.
 */
export function blockDctPlane(p: ImagePlane, n: number): ImagePlane {
  const bw = Math.ceil(p.width / n);
  const bh = Math.ceil(p.height / n);
  const out = makePlane(bw * n, bh * n);
  out.crop = { width: p.width, height: p.height };
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const c = dct2(readBlock(p, bx, by, n, 128), n);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) out.data[(by * n + y) * out.width + bx * n + x] = c[y * n + x];
    }
  return out;
}

export function blockIdctPlane(p: ImagePlane, n: number): ImagePlane {
  const w = p.crop?.width ?? p.width;
  const h = p.crop?.height ?? p.height;
  const out = makePlane(w, h);
  for (let by = 0; by < p.height / n; by++)
    for (let bx = 0; bx < p.width / n; bx++) {
      const px = idct2(readBlock(p, bx, by, n), n);
      for (let y = 0; y < n; y++) {
        const yy = by * n + y;
        if (yy >= h) break;
        for (let x = 0; x < n; x++) {
          const xx = bx * n + x;
          if (xx < w) out.data[yy * w + xx] = clamp255(px[y * n + x] + 128);
        }
      }
    }
  return out;
}

/** Recorrido en zigzag de un bloque n×n: índice (fila·n + columna) de cada posición. */
export function zigzag(n: number): number[] {
  const order: number[] = [];
  for (let s = 0; s < 2 * n - 1; s++) {
    const cells: number[] = [];
    for (let y = 0; y < n; y++) {
      const x = s - y;
      if (x >= 0 && x < n) cells.push(y * n + x);
    }
    // Las diagonales pares suben (de abajo a arriba) y las impares bajan.
    order.push(...(s % 2 === 0 ? cells.reverse() : cells));
  }
  return order;
}

// ─── Calidad ────────────────────────────────────────────────────────────────

/** Error cuadrático medio entre dos imágenes del mismo tamaño (todos los planos). */
export function imageMse(a: Image, b: Image): number {
  const pa = fullPlanes(a);
  const pb = fullPlanes(b);
  let s = 0;
  let n = 0;
  for (let c = 0; c < pa.length; c++)
    for (let i = 0; i < pa[c].length; i++) {
      const d = pa[c][i] - pb[c][i];
      s += d * d;
      n++;
    }
  return s / Math.max(1, n);
}

export const psnrFromMse = (mse: number) =>
  mse <= 1e-12 ? Infinity : 10 * Math.log10((255 * 255) / mse);

/**
 * SSIM (Wang et al., 2004) sobre la luminancia, en ventanas de 8×8 que
 * avanzan de 4 en 4. Compara brillo, contraste y estructura: se parece más
 * a lo que ve el ojo que el PSNR.
 */
export function ssim(a: ImagePlane, b: ImagePlane): number {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const w = 8;
  let total = 0;
  let count = 0;
  for (let y = 0; y + w <= a.height; y += 4)
    for (let x = 0; x + w <= a.width; x += 4) {
      let ma = 0;
      let mb = 0;
      for (let j = 0; j < w; j++)
        for (let i = 0; i < w; i++) {
          ma += a.data[(y + j) * a.width + x + i];
          mb += b.data[(y + j) * b.width + x + i];
        }
      ma /= w * w;
      mb /= w * w;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let j = 0; j < w; j++)
        for (let i = 0; i < w; i++) {
          const da = a.data[(y + j) * a.width + x + i] - ma;
          const db = b.data[(y + j) * b.width + x + i] - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      const k = w * w - 1;
      va /= k;
      vb /= k;
      cov /= k;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  return count ? total / count : 1;
}

/** Plano de luminancia a tamaño completo, sea cual sea el espacio de color. */
export function luminance(img: Image): ImagePlane {
  if (img.color === 'rgb') return convertColor(img, 'gray').planes[0];
  return img.planes[0];
}

// ─── Para pintar ────────────────────────────────────────────────────────────

export interface Rgba {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/**
 * Imagen RGBA para la pantalla, reducida para que el lado mayor no pase de
 * `maxSide`. Los coeficientes DCT se pintan como |coef| en escala
 * logarítmica: se ven los bloques y cuánta energía queda en cada uno.
 */
export function toRgba(img: Image, maxSide = 128): Rgba {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (img.domain === 'dct') {
    const p = img.planes[0];
    const small = resamplePlane(
      { ...p, data: p.data.map((v) => Math.log1p(Math.abs(v))) },
      Math.max(1, Math.round(p.width * scale)),
      Math.max(1, Math.round(p.height * scale)),
    );
    let max = 1e-9;
    for (const v of small.data) max = Math.max(max, v);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const v = 255 * (small.data[Math.min(small.height - 1, y) * small.width + x] / max);
        const o = (y * width + x) * 4;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
        rgba[o + 3] = 255;
      }
    return { width, height, rgba };
  }
  const rgb = convertColor(img, img.color === 'gray' ? 'gray' : 'rgb');
  const planes = rgb.planes.map((p) => resamplePlane(p, width, height).data);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = planes[0][i];
    rgba[i * 4 + 1] = planes[planes.length > 1 ? 1 : 0][i];
    rgba[i * 4 + 2] = planes[planes.length > 1 ? 2 : 0][i];
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

/** Un plano suelto como imagen gris RGBA (para enseñar diferencias, planos de bits…). */
export function planeToRgba(p: ImagePlane, maxSide = 256): Rgba {
  return toRgba(makeImage([p], 'gray'), maxSide);
}

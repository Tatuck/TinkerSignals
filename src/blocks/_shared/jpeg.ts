import { BitReader, BitWriter } from '@/engine/dsp/bits';
import {
  blockDctPlane,
  blockIdctPlane,
  convertColor,
  makeImage,
  makePlane,
  resamplePlane,
  SUBSAMPLING,
  zigzag,
  type Subsampling,
} from '@/engine/dsp/image';
import type { Image, ImagePlane } from '@/engine/types';

/**
 * Núcleo de JPEG básico (secuencial, Huffman con las tablas típicas del
 * anexo K de la norma). Lo comparten el codificador, el decodificador y las
 * piezas sueltas (cuantizador DCT), así que todos usan las mismas tablas.
 */

// ─── Tablas de cuantización (anexo K.1) ─────────────────────────────────────

export const LUMA_TABLE = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

export const CHROMA_TABLE = [
  17,
  18,
  24,
  47,
  99,
  99,
  99,
  99,
  18,
  21,
  26,
  66,
  99,
  99,
  99,
  99,
  24,
  26,
  56,
  99,
  99,
  99,
  99,
  99,
  47,
  66,
  99,
  99,
  99,
  99,
  99,
  99,
  ...new Array<number>(32).fill(99),
];

/**
 * Escala una tabla con el factor de calidad (1–100) como hace la libjpeg
 * del IJG: 50 deja la tabla tal cual, 100 la lleva a todo unos.
 */
export function scaledTable(base: number[], quality: number): number[] {
  const q = Math.max(1, Math.min(100, Math.round(quality)));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return base.map((v) => Math.max(1, Math.min(255, Math.floor((v * s + 50) / 100))));
}

/** Tabla de paso para un bloque n×n: la de JPEG si n = 8, uniforme (16 escalado) si no. */
export function quantTable(n: number, chroma: boolean, quality: number, uniform = false): number[] {
  if (n === 8 && !uniform) return scaledTable(chroma ? CHROMA_TABLE : LUMA_TABLE, quality);
  return scaledTable(new Array<number>(n * n).fill(16), quality);
}

/** Cuantiza y descuantiza un plano de coeficientes DCT con la tabla dada. */
export function quantizePlane(p: ImagePlane, n: number, table: number[]): ImagePlane {
  const out = { ...p, data: new Float32Array(p.data.length) };
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const i = y * p.width + x;
      const q = table[(y % n) * n + (x % n)];
      out.data[i] = Math.round(p.data[i] / q) * q;
    }
  return out;
}

// ─── Tablas de Huffman típicas (anexo K.3) ──────────────────────────────────

interface HuffSpec {
  bits: number[];
  values: number[];
}

const DC_LUMA: HuffSpec = {
  bits: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const DC_CHROMA: HuffSpec = {
  bits: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Los 160 símbolos (racha, tamaño) más EOB y ZRL, en el orden de la norma. */
const acValues = (head: number[]) => {
  const rest: number[] = [];
  for (let run = 0; run < 16; run++)
    for (let size = 1; size <= 10; size++) {
      const v = (run << 4) | size;
      if (!head.includes(v)) rest.push(v);
    }
  return [...head, ...rest];
};

const AC_LUMA: HuffSpec = {
  bits: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
  values: acValues([
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ]),
};
const AC_CHROMA: HuffSpec = {
  bits: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
  values: acValues([
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
    0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
    0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
    0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
    0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
    0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
    0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ]),
};

interface HuffTable {
  /** símbolo → [código, longitud] */
  enc: Map<number, [number, number]>;
  /** "longitud:código" → símbolo */
  dec: Map<string, number>;
}

/** Códigos canónicos a partir de cuántos hay de cada longitud (como en la norma). */
function buildTable(spec: HuffSpec): HuffTable {
  const enc = new Map<number, [number, number]>();
  const dec = new Map<string, number>();
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < spec.bits[len - 1]; i++) {
      const sym = spec.values[k++];
      enc.set(sym, [code, len]);
      dec.set(`${len}:${code}`, sym);
      code++;
    }
    code <<= 1;
  }
  return { enc, dec };
}

export const TABLES = {
  dc: [buildTable(DC_LUMA), buildTable(DC_CHROMA)],
  ac: [buildTable(AC_LUMA), buildTable(AC_CHROMA)],
};
export const __specs = { DC_LUMA, DC_CHROMA, AC_LUMA, AC_CHROMA };

// ─── Codificación de un valor: categoría (tamaño) + bits ───────────────────

/** Categoría de un valor: cuántos bits hacen falta para su magnitud. */
export const category = (v: number) => (v === 0 ? 0 : Math.floor(Math.log2(Math.abs(v))) + 1);

/** Bits del valor dentro de su categoría (los negativos, en complemento a 1). */
const valueBits = (v: number, size: number) => (v >= 0 ? v : v + (1 << size) - 1);
const bitsToValue = (b: number, size: number) =>
  size === 0 ? 0 : b >> (size - 1) ? b : b - (1 << size) + 1;

function writeSym(w: BitWriter, t: HuffTable, sym: number): number {
  const [code, len] = t.enc.get(sym)!;
  w.write(code, len);
  return len;
}

function readSym(r: BitReader, t: HuffTable): number | null {
  let code = 0;
  for (let len = 1; len <= 16; len++) {
    code = (code << 1) | r.readBit();
    const s = t.dec.get(`${len}:${code}`);
    if (s !== undefined) return s;
  }
  return null;
}

// ─── Codificador y decodificador completos ─────────────────────────────────

const SUBS = Object.keys(SUBSAMPLING) as Subsampling[];
const ZZ = zigzag(8);

export interface JpegStats {
  /** Bits gastados en coeficientes DC, en AC y en la cabecera. */
  dcBits: number;
  acBits: number;
  headerBits: number;
  /** Bits de cada componente (Y, Cb, Cr). */
  componentBits: number[];
  /** Coeficientes distintos de cero por bloque de la luminancia (mapa). */
  nonZero: ImagePlane;
  zeroRatio: number;
}

/**
 * Codifica una imagen como JPEG básico. Cada componente va en su propio
 * barrido (JPEG lo permite: barridos no entrelazados), bloque a bloque de
 * izquierda a derecha y de arriba abajo. La cabecera (tamaño, color,
 * submuestreo y calidad) viaja dentro del flujo, como en un .jpg real.
 */
export function jpegEncode(
  img: Image,
  quality: number,
  subsampling: Subsampling,
): { writer: BitWriter; stats: JpegStats } {
  const gray = img.color === 'gray';
  const ycc = gray ? img : convertColor(img, 'ycbcr');
  const [fx, fy] = SUBSAMPLING[subsampling];
  const planes = ycc.planes.map((p, c) =>
    c === 0 || gray ? p : resamplePlane(p, Math.ceil(img.width / fx), Math.ceil(img.height / fy)),
  );

  const w = new BitWriter();
  w.write(img.width, 16);
  w.write(img.height, 16);
  w.write(gray ? 0 : 1, 1);
  w.write(SUBS.indexOf(subsampling), 2);
  w.write(Math.round(quality), 7);
  const stats: JpegStats = {
    dcBits: 0,
    acBits: 0,
    headerBits: w.bitLength,
    componentBits: [],
    nonZero: makePlane(Math.ceil(img.width / 8), Math.ceil(img.height / 8)),
    zeroRatio: 0,
  };
  let zeros = 0;
  let total = 0;

  planes.forEach((p, c) => {
    const start = w.bitLength;
    const chroma = c > 0 ? 1 : 0;
    const table = quantTable(8, chroma === 1, quality);
    const coefs = blockDctPlane(p, 8);
    const bw = coefs.width / 8;
    let prevDc = 0;
    for (let by = 0; by < coefs.height / 8; by++)
      for (let bx = 0; bx < bw; bx++) {
        // Coeficientes cuantizados del bloque, en orden zigzag.
        const q = ZZ.map((idx) => {
          const v = coefs.data[(by * 8 + (idx >> 3)) * coefs.width + bx * 8 + (idx & 7)];
          return Math.round(v / table[idx]);
        });
        const dc = Math.max(-2047, Math.min(2047, q[0] - prevDc));
        prevDc += dc;
        const ds = category(dc);
        stats.dcBits += writeSym(w, TABLES.dc[chroma], ds) + ds;
        w.write(valueBits(dc, ds), ds);
        let run = 0;
        let nz = 0;
        let last = 63;
        while (last > 0 && q[last] === 0) last--;
        for (let k = 1; k <= last; k++) {
          const v = Math.max(-1023, Math.min(1023, q[k]));
          if (v === 0) {
            run++;
            continue;
          }
          nz++;
          while (run > 15) {
            stats.acBits += writeSym(w, TABLES.ac[chroma], 0xf0);
            run -= 16;
          }
          const s = category(v);
          stats.acBits += writeSym(w, TABLES.ac[chroma], (run << 4) | s) + s;
          w.write(valueBits(v, s), s);
          run = 0;
        }
        if (last < 63) stats.acBits += writeSym(w, TABLES.ac[chroma], 0x00);
        zeros += 63 - nz;
        total += 63;
        if (c === 0 && by < stats.nonZero.height && bx < stats.nonZero.width)
          stats.nonZero.data[by * stats.nonZero.width + bx] = nz + (q[0] !== 0 ? 1 : 0);
      }
    stats.componentBits.push(w.bitLength - start);
  });
  stats.zeroRatio = total ? zeros / total : 0;
  return { writer: w, stats };
}

export interface JpegDecoded {
  image: Image;
  quality: number;
  subsampling: Subsampling;
  /** Códigos que no se han podido leer (flujo dañado). */
  badCodes: number;
}

/**
 * Decodifica lo que escribió `jpegEncode`. Si el flujo llega dañado no se
 * para: un código ilegible termina el bloque y se sigue con el siguiente,
 * así se ve cómo se propaga el error (la DC es diferencial).
 */
export function jpegDecode(bytes: Uint8Array, bitLength: number): JpegDecoded {
  const r = new BitReader(bytes, bitLength);
  const width = r.read(16);
  const height = r.read(16);
  const color = r.read(1) === 1;
  const subsampling = SUBS[r.read(2)] ?? '4:2:0';
  const quality = Math.max(1, r.read(7));
  if (!width || !height || width > 4096 || height > 4096) {
    throw new Error('La cabecera JPEG está dañada: el tamaño de la imagen no tiene sentido.');
  }
  const [fx, fy] = SUBSAMPLING[subsampling];
  const sizes = color
    ? [
        [width, height],
        [Math.ceil(width / fx), Math.ceil(height / fy)],
        [Math.ceil(width / fx), Math.ceil(height / fy)],
      ]
    : [[width, height]];
  let badCodes = 0;
  const planes = sizes.map(([pw, ph], c) => {
    const chroma = c > 0 ? 1 : 0;
    const table = quantTable(8, chroma === 1, quality);
    const coefs = makePlane(Math.ceil(pw / 8) * 8, Math.ceil(ph / 8) * 8);
    coefs.crop = { width: pw, height: ph };
    let prevDc = 0;
    for (let by = 0; by < coefs.height / 8; by++)
      for (let bx = 0; bx < coefs.width / 8; bx++) {
        const q = new Array<number>(64).fill(0);
        const ds = readSym(r, TABLES.dc[chroma]);
        if (ds === null) badCodes++;
        const size = Math.min(ds ?? 0, 11);
        prevDc += bitsToValue(r.read(size), size);
        q[0] = prevDc;
        for (let k = 1; k < 64;) {
          const sym = readSym(r, TABLES.ac[chroma]);
          if (sym === null) {
            badCodes++;
            break;
          }
          if (sym === 0x00) break;
          const run = sym >> 4;
          const s = sym & 15;
          k += run;
          if (k > 63) break;
          q[k++] = bitsToValue(r.read(s), s);
        }
        for (let k = 0; k < 64; k++) {
          const idx = ZZ[k];
          coefs.data[(by * 8 + (idx >> 3)) * coefs.width + bx * 8 + (idx & 7)] = q[k] * table[idx];
        }
      }
    return blockIdctPlane(coefs, 8);
  });
  const ycc = makeImage(planes, color ? 'ycbcr' : 'gray');
  return {
    image: color ? convertColor(ycc, 'rgb') : ycc,
    quality,
    subsampling,
    badCodes,
  };
}

import { BitReader, BitWriter } from '@/engine/dsp/bits';
import type { Bitstream, BitstreamHeader, Image } from '@/engine/types';

/**
 * Esteganografía por el bit menos significativo (LSB). Un mensaje (cualquier
 * flujo de bits) se esconde en los k bits más bajos de unas muestras enteras
 * (píxeles de 0–255 o audio de 16 bits). Cambiar esos bits apenas altera la
 * imagen o el sonido, pero quien sabe dónde mirar recupera el mensaje.
 *
 * Lo que se esconde lleva delante una marca, la cabecera del flujo (en JSON)
 * y su longitud, para que el revelador pueda reconstruirlo entero.
 */

const MAGIC = 0x5453; // «TS»

/** Bits que ocupa el flujo una vez preparado para esconderlo. */
function serialize(b: Bitstream): BitWriter {
  const header = new TextEncoder().encode(JSON.stringify(b.header));
  const w = new BitWriter();
  w.write(MAGIC, 16);
  w.write(header.length, 16);
  for (const byte of header) w.write(byte, 8);
  w.write(Math.min(0xffffffff, b.referenceBits), 32);
  w.write(b.bitLength, 32);
  const r = new BitReader(b.bytes, b.bitLength);
  for (let i = 0; i < b.bitLength; i++) w.writeBit(r.readBit());
  return w;
}

export interface HideResult {
  /** Bits del mensaje (con su cabecera) escondidos. */
  usedBits: number;
  capacityBits: number;
}

/**
 * Esconde `message` en los `k` bits bajos de `carrier` (enteros sin signo de
 * `width` bits, modificados en el sitio). Lanza un error si no cabe.
 */
export function hideBits(carrier: Int32Array, k: number, message: Bitstream): HideResult {
  const w = serialize(message);
  const { bytes, bitLength } = w.finish();
  const capacityBits = carrier.length * k;
  if (bitLength > capacityBits) {
    throw new Error(
      `El mensaje no cabe: necesita ${bitLength} bits y aquí solo hay sitio para ${capacityBits}. Usa más bits por muestra o un portador más grande.`,
    );
  }
  const r = new BitReader(bytes, bitLength);
  const mask = (1 << k) - 1;
  const used = Math.ceil(bitLength / k);
  for (let i = 0; i < used; i++) carrier[i] = (carrier[i] & ~mask) | r.read(k);
  return { usedBits: bitLength, capacityBits };
}

/** Recupera lo que escondió `hideBits`. */
export function revealBits(carrier: Int32Array, k: number): Bitstream {
  const mask = (1 << k) - 1;
  const all = new BitWriter();
  for (const v of carrier) all.write(v & mask, k);
  const { bytes, bitLength } = all.finish();
  const r = new BitReader(bytes, bitLength);
  if (r.read(16) !== MAGIC) {
    throw new Error(
      'No hay ningún mensaje escondido, o no se ha escondido con estos bits por muestra. Si la imagen o el audio se han comprimido con pérdidas por el camino, el mensaje se ha borrado.',
    );
  }
  const headerLen = r.read(16);
  const headerBytes = new Uint8Array(headerLen);
  for (let i = 0; i < headerLen; i++) headerBytes[i] = r.read(8);
  let header: BitstreamHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes)) as BitstreamHeader;
  } catch {
    throw new Error('La cabecera del mensaje escondido está dañada.');
  }
  const referenceBits = r.read(32);
  const length = Math.min(r.read(32), r.remaining);
  const out = new BitWriter();
  for (let i = 0; i < length; i++) out.writeBit(r.readBit());
  const payload = out.finish();
  return {
    kind: 'bitstream',
    bytes: payload.bytes,
    bitLength: payload.bitLength,
    header,
    referenceBits,
  };
}

/** Plano de los k bits bajos, ampliado a 0–255 para poder verlo. */
export function lsbView(values: Int32Array, k: number): Float32Array {
  const mask = (1 << k) - 1;
  return Float32Array.from(values, (v) => ((v & mask) * 255) / mask);
}

// ─── Portadores ─────────────────────────────────────────────────────────────

/** Píxeles de todos los planos como enteros de 0–255 (el portador de una imagen). */
export function imageToInts(img: Image): Int32Array {
  const n = img.planes.reduce((a, p) => a + p.data.length, 0);
  const out = new Int32Array(n);
  let o = 0;
  for (const p of img.planes)
    for (const v of p.data) out[o++] = Math.max(0, Math.min(255, Math.round(v)));
  return out;
}

/** Imagen con los mismos planos que `like` y los valores de `ints`. */
export function intsToImage(like: Image, ints: Int32Array): Image {
  let o = 0;
  return {
    ...like,
    planes: like.planes.map((p) => ({
      ...p,
      data: Float32Array.from({ length: p.data.length }, () => ints[o++]),
    })),
  };
}

/** Audio en [-1, 1] como enteros de 16 bits sin signo (0–65535). */
export function signalToInts(samples: Float32Array): Int32Array {
  return Int32Array.from(samples, (v) =>
    Math.max(0, Math.min(65535, Math.round(Math.max(-1, Math.min(1, v)) * 32767) + 32768)),
  );
}

export const intsToSamples = (ints: Int32Array) =>
  Float32Array.from(ints, (v) => (v - 32768) / 32767);

import type { Bitstream, BitstreamHeader } from '../types';
import type { BitWriter } from './bits';

/** Empaqueta lo escrito en un BitWriter como valor de cable. */
export function makeBitstream(
  w: BitWriter,
  header: BitstreamHeader,
  referenceBits: number,
): Bitstream {
  const { bytes, bitLength, layout } = w.finish();
  return { kind: 'bitstream', bytes, bitLength, header, referenceBits, ...(layout && { layout }) };
}

/** PCM lineal de 16 bits: la referencia para el factor de compresión. */
export const referenceBitsFor = (numSamples: number) => numSamples * 16;

/** Comprueba que el decodificador recibe el formato que sabe leer. */
export function expectCodec(b: Bitstream, codec: string, blockName: string): void {
  if (b.header.codec !== codec) {
    throw new Error(
      `${blockName} espera un flujo «${codec}» y le llega «${b.header.codec}». Conecta el decodificador que corresponde a su codificador.`,
    );
  }
}

export function bitrateOf(b: Bitstream): number {
  return (b.bitLength * b.header.sampleRate) / Math.max(1, b.header.numSamples);
}

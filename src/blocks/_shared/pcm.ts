import { BitReader, BitWriter } from '@/engine/dsp/bits';
import { compress, expand, type Law } from '@/engine/dsp/companding';
import { uniformIndex, uniformValue } from '@/engine/dsp/quantize';

/** Núcleo PCM compartido por el codificador y el decodificador. */
export interface PcmConfig {
  bits: number;
  law: Law;
  mu: number;
}

export function pcmEncode(x: Float32Array, c: PcmConfig): { writer: BitWriter; codes: Uint32Array } {
  const w = new BitWriter();
  const codes = new Uint32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    codes[i] = uniformIndex(compress(x[i], c.law, c.mu), c.bits, 'midrise');
    w.write(codes[i], c.bits);
  }
  return { writer: w, codes };
}

export function pcmDecodeValue(code: number, c: PcmConfig): number {
  return expand(uniformValue(code, c.bits, 'midrise'), c.law, c.mu);
}

export function pcmDecode(bytes: Uint8Array, bitLength: number, n: number, c: PcmConfig): Float32Array {
  const r = new BitReader(bytes, bitLength);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = pcmDecodeValue(r.read(c.bits), c);
  return y;
}

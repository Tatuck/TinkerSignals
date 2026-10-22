import { BitReader, BitWriter } from '@/engine/dsp/bits';

/**
 * ADPCM IMA (4 bits por muestra). El paso del cuantizador se adapta solo:
 * crece cuando los códigos son grandes y encoge cuando son pequeños. El
 * decodificador hace la misma adaptación a partir de los códigos, así que
 * no hace falta enviar el paso.
 */
const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73,
  80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494,
  544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499,
  2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];

interface State {
  pred: number;
  index: number;
}

/** Reconstruye una muestra a partir de un código (común a codificador y decodificador). */
function decodeNibble(code: number, s: State): number {
  const step = STEP_TABLE[s.index];
  let diff = step >> 3;
  if (code & 4) diff += step;
  if (code & 2) diff += step >> 1;
  if (code & 1) diff += step >> 2;
  s.pred = Math.max(-32768, Math.min(32767, s.pred + (code & 8 ? -diff : diff)));
  s.index = Math.max(0, Math.min(88, s.index + INDEX_TABLE[code]));
  return s.pred;
}

export function adpcmEncode(x: Float32Array): {
  writer: BitWriter;
  reconstructed: Float32Array;
  steps: Float32Array;
} {
  const w = new BitWriter();
  const s: State = { pred: 0, index: 0 };
  const rec = new Float32Array(x.length);
  const steps = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const sample = Math.round(Math.max(-1, Math.min(1, x[i])) * 32767);
    const step = STEP_TABLE[s.index];
    steps[i] = step / 32768;
    let diff = sample - s.pred;
    let code = 0;
    if (diff < 0) {
      code = 8;
      diff = -diff;
    }
    if (diff >= step) {
      code |= 4;
      diff -= step;
    }
    if (diff >= step >> 1) {
      code |= 2;
      diff -= step >> 1;
    }
    if (diff >= step >> 2) code |= 1;
    w.frame();
    w.write(code >> 3, 1, 'sign');
    w.write(code & 7, 3, 'magnitude');
    rec[i] = decodeNibble(code, s) / 32768;
  }
  return { writer: w, reconstructed: rec, steps };
}

export function adpcmDecode(bytes: Uint8Array, bitLength: number, n: number): Float32Array {
  const r = new BitReader(bytes, bitLength);
  const s: State = { pred: 0, index: 0 };
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = decodeNibble(r.read(4), s) / 32768;
  return y;
}

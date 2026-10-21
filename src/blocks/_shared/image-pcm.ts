import type { Image } from '@/engine/types';

/**
 * PCM de imagen: cada píxel (0–255) se cuantiza a `bits` bits. Lo comparten
 * el codificador y el decodificador.
 */
export const pixelToLevel = (v: number, bits: number) =>
  Math.max(0, Math.min(2 ** bits - 1, Math.floor((v * 2 ** bits) / 256)));

/** Valor de 0–255 del centro del nivel (así 3 bits recuperan exactos los niveles de 0 a 7). */
export const levelToPixel = (l: number, bits: number) => ((l + 0.5) * 256) / 2 ** bits;

export function levelsToImage(like: Image, levels: Int32Array[], bits: number): Image {
  return {
    ...like,
    domain: 'pixels',
    planes: like.planes.map((p, c) => ({
      width: p.width,
      height: p.height,
      data: Float32Array.from(levels[c], (l) => levelToPixel(l, bits)),
    })),
  };
}

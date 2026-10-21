import { clamp255, makeImage, makePlane } from '@/engine/dsp/image';
import type { Image } from '@/engine/types';
import { levelToPixel } from './image-pcm';
import { seededRandom } from './random';

/**
 * Imágenes de prueba generadas por código (sin derechos de autor). Cada una
 * sirve para ver algo distinto: zonas suaves, bordes, color, aliasing…
 */
export const TEST_IMAGES = [
  'paisaje',
  'degradado',
  'tablero',
  'zona',
  'barras',
  'ruido',
  'ejercicio-3',
  'ejercicio-7',
] as const;
export type TestImage = (typeof TEST_IMAGES)[number];

/**
 * Matrices de los ejercicios del tema 4. Sus valores son niveles (8 niveles,
 * 3 bits); se guardan como el centro de cada nivel en 0–255 para que una
 * cuantización a 3 bits los recupere exactos.
 */
const EXERCISES: Record<'ejercicio-3' | 'ejercicio-7', number[][]> = {
  'ejercicio-3': [
    [0, 2, 7, 3, 6],
    [7, 3, 4, 1, 4],
    [6, 5, 4, 2, 3],
    [1, 6, 7, 3, 0],
    [5, 6, 6, 5, 6],
  ],
  'ejercicio-7': [
    [0, 0, 0, 0, 0, 0, 4, 3],
    [0, 6, 5, 7, 7, 6, 3, 3],
    [0, 1, 4, 6, 7, 5, 3, 3],
    [0, 3, 4, 6, 7, 5, 3, 3],
    [0, 1, 3, 5, 5, 4, 3, 2],
    [0, 1, 3, 5, 4, 4, 2, 1],
    [0, 1, 3, 4, 4, 3, 1, 1],
    [0, 0, 0, 0, 0, 6, 4, 5],
  ],
};

export function testImage(name: TestImage, size: number, color: boolean): Image {
  if (name === 'ejercicio-3' || name === 'ejercicio-7') {
    const m = EXERCISES[name];
    const p = makePlane(m[0].length, m.length);
    m.forEach((row, y) => row.forEach((v, x) => (p.data[y * p.width + x] = levelToPixel(v, 3))));
    return makeImage([p], 'gray');
  }
  const w = size;
  const h = size;
  const [r, g, b] = [0, 1, 2].map(() => makePlane(w, h));
  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const i = y * w + x;
    r.data[i] = clamp255(rgb[0]);
    g.data[i] = clamp255(rgb[1]);
    b.data[i] = clamp255(rgb[2]);
  };
  const rand = seededRandom(7);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      switch (name) {
        case 'paisaje': {
          // Cielo en degradado, un sol, dos cordilleras y hierba con textura.
          const ridge1 = 0.55 + 0.08 * Math.sin(u * 7 + 1) + 0.04 * Math.sin(u * 19);
          const ridge2 = 0.68 + 0.05 * Math.sin(u * 5 + 3) + 0.03 * Math.sin(u * 23 + 1);
          const sun = Math.hypot(u - 0.72, v - 0.25) < 0.09;
          let c: [number, number, number] = [110 + 90 * v, 160 + 70 * v, 235 - 20 * v];
          if (sun) c = [255, 226, 120];
          if (v > ridge1) c = [92 - 30 * (v - ridge1), 104 - 30 * (v - ridge1), 140];
          if (v > ridge2) {
            const n = rand() * 30 - 15;
            c = [60 + n + 40 * Math.sin(x * 0.9), 140 + n + 20 * (1 - v), 55 + n];
          }
          set(x, y, c);
          break;
        }
        case 'degradado':
          set(x, y, [255 * u, 255 * v, 255 * (1 - u)]);
          break;
        case 'tablero': {
          const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
          set(x, y, on ? [235, 235, 235] : [25, 25, 25]);
          break;
        }
        case 'zona': {
          // Placa zonal: la frecuencia crece hacia los bordes. Delata el aliasing.
          const d = (u - 0.5) ** 2 + (v - 0.5) ** 2;
          const l = 127.5 + 127.5 * Math.cos(Math.PI * d * w * 0.9);
          set(x, y, [l, l, l]);
          break;
        }
        case 'barras': {
          const bars: [number, number, number][] = [
            [235, 235, 235],
            [235, 235, 16],
            [16, 235, 235],
            [16, 235, 16],
            [235, 16, 235],
            [235, 16, 16],
            [16, 16, 235],
            [16, 16, 16],
          ];
          set(x, y, bars[Math.min(7, Math.floor(u * 8))]);
          break;
        }
        case 'ruido': {
          const n = rand() * 255;
          set(x, y, [n, n, n]);
          break;
        }
      }
    }
  const rgb = makeImage([r, g, b], 'rgb');
  if (color) return rgb;
  const gray = makePlane(w, h);
  for (let i = 0; i < w * h; i++)
    gray.data[i] = 0.299 * r.data[i] + 0.587 * g.data[i] + 0.114 * b.data[i];
  return makeImage([gray], 'gray');
}

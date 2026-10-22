import { loadFont } from '@remotion/google-fonts/IBMPlexSans';

// La misma letra que la app; una sola familia en todo el vídeo.
export const SANS = loadFont('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;

/** Tinta, fondo y acento: los de la app (src/ui/styles.css). */
export const C = {
  tinta: '#15181d',
  fondoApp: '#f3f5f8',
  blanco: '#ffffff',
  ambar: '#f2b230',
};

/** Forma del conector, como los puertos de la app: círculo, cuadrado, pastilla, rectángulo o rombo. */
export type Forma = 'circulo' | 'cuadrado' | 'pastilla' | 'rect' | 'rombo';
export type Cable = { color: string; texto: string; forma: Forma };

/** Cada capítulo toma el color y el conector de un cable de la app (src/ui/theme.ts). */
export const CABLE = {
  senal: { color: '#2563D9', texto: '#ffffff', forma: 'circulo' },
  bits: { color: '#C98A00', texto: '#15181d', forma: 'cuadrado' },
  tramas: { color: '#B8336A', texto: '#ffffff', forma: 'pastilla' },
  imagen: { color: '#6A4FC4', texto: '#ffffff', forma: 'rect' },
  onda: { color: '#0B7F8C', texto: '#ffffff', forma: 'circulo' },
  // No es un cable: es el color de la categoría «perceptual» (MPEG-1).
  perceptual: { color: '#B25F00', texto: '#ffffff', forma: 'circulo' },
  paquetes: { color: '#16895C', texto: '#ffffff', forma: 'rombo' },
  // Tampoco son cables: los colores de las categorías «sin pérdidas» y «piezas».
  sinPerdidas: { color: '#557A17', texto: '#ffffff', forma: 'circulo' },
  piezas: { color: '#9A4777', texto: '#ffffff', forma: 'circulo' },
} satisfies Record<string, Cable>;

/** Medidas de la columna (16:9) y de la banda (1:1) donde va el capítulo. */
export const COLUMNA = 640;
export const BANDA = 360;

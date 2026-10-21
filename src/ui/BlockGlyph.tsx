import type { CSSProperties } from 'react';
import type { BlockCategory } from '@/engine/types';
import { categoryColor, categoryTint } from './theme';

/** Trazos de cada categoría, dibujados en una rejilla de 20 × 20. */
const paths: Record<BlockCategory, string> = {
  // Altavoz con ondas: de aquí sale el sonido.
  entrada: 'M3.5 8v4h3l4 3.5v-11l-4 3.5zM13.5 7.5a3.5 3.5 0 0 1 0 5M15.8 5.2a6.8 6.8 0 0 1 0 9.6',
  // Escalera: muestras y niveles.
  digitalizacion: 'M3 16h3v-4h3V8h3V5h3v5h2',
  // Onda continua.
  'forma-de-onda': 'M2.5 10c1.6-5 3.4-5 5 0s3.4 5 5 0 3.4-5 5 0',
  // Bocadillo: voz.
  voz: 'M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 12.5V6A1.5 1.5 0 0 1 4 4.5zM7 9.5v.5M10 7.5v4M13 8.5v2',
  // Barras de un espectro.
  perceptual: 'M4 16V9M8 16V4.5M12 16V7M16 16v-4.5',
  // Dos corchetes que aprietan.
  'sin-perdidas': 'M6.5 4H4v12h2.5M13.5 4H16v12h-2.5M8.5 10h3',
  // Tres nodos de una red.
  canal:
    'M5 6.5a2 2 0 1 0 0-.01zM15 6.5a2 2 0 1 0 0-.01zM10 15.5a2 2 0 1 0 0-.01zM7 6.5h6M6 8.3l3 5.4M14 8.3l-3 5.4',
  // Cubo: una pieza básica.
  piezas: 'M10 2.8 16.5 6.4v7.2L10 17.2 3.5 13.6V6.4zM3.5 6.4 10 10l6.5-3.6M10 10v7.2',
  // Dos deslizadores.
  utilidades: 'M3 7h14M3 13h14M7 5v4M13 11v4',
  // Marco con una montaña y un sol: una foto.
  imagen: 'M3.5 4.5h13v11h-13zM3.5 13l4-4 3.5 3.5 2-2 3.5 3.5M13 8a1 1 0 1 0 0-.01z',
  // Auriculares.
  salida:
    'M4 13V10a6 6 0 0 1 12 0v3M4 12.5h2.5V17H5a1 1 0 0 1-1-1zM16 12.5h-2.5V17H15a1 1 0 0 0 1-1z',
};

/** Ficha de tipo de bloque: fondo pálido y glifo en el color de su categoría. */
export function BlockGlyph({ category, size = 28 }: { category: BlockCategory; size?: number }) {
  return (
    <span
      className="glyph"
      aria-hidden
      style={
        {
          '--glyph-bg': categoryTint[category],
          '--glyph-ink': categoryColor[category],
          width: size,
          height: size,
        } as CSSProperties
      }
    >
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 20 20">
        <path
          d={paths[category]}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

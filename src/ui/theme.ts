import type { BlockCategory, PortType } from '@/engine/types';

/**
 * Color de cada categoría. Solo marca la identidad del bloque: el glifo de su
 * ficha y el borde cuando está seleccionado. Las gráficas usan un único color.
 */
export const categoryColor: Record<BlockCategory, string> = {
  entrada: '#1E7F52',
  digitalizacion: '#2563D9',
  'forma-de-onda': '#0B7F8C',
  voz: '#BE2459',
  perceptual: '#B25F00',
  'sin-perdidas': '#557A17',
  canal: '#566273',
  piezas: '#9A4777',
  utilidades: '#8A6A12',
  imagen: '#6A4FC4',
  salida: '#1A1D23',
};

/** Fondo pálido de la ficha de cada categoría (el mismo en la paleta y en el lienzo). */
export const categoryTint: Record<BlockCategory, string> = {
  entrada: '#DDF3E6',
  digitalizacion: '#E0EAFC',
  'forma-de-onda': '#D9F1F3',
  voz: '#FBE1EA',
  perceptual: '#FCEBD6',
  'sin-perdidas': '#E8F1D6',
  canal: '#E6E9EE',
  piezas: '#F5E1EC',
  utilidades: '#F6EDCF',
  imagen: '#ECE6FA',
  salida: '#E4E6EA',
};

export const categoryOrder: BlockCategory[] = [
  'entrada',
  'digitalizacion',
  'forma-de-onda',
  'voz',
  'perceptual',
  'sin-perdidas',
  'canal',
  'imagen',
  'piezas',
  'utilidades',
  'salida',
];

/** Color de cable por tipo de dato. La forma del conector también cambia (círculo/cuadrado). */
export const portColor: Record<PortType, string> = {
  signal: '#2563D9',
  bitstream: '#C98A00',
  packets: '#16895C',
  frames: '#B8336A',
  image: '#6A4FC4',
};

/** El único color de datos: la salida de cada bloque en sus gráficas. */
export const outputSeriesColor = '#2563D9';
export const inputSeriesColor = '#A9B1BD';
export const errorSeriesColor = '#C4242A';

import type { BlockCategory, PortType } from '@/engine/types';

/** Color de cada categoría: cabecera del bloque, trazo de "salida" en sus gráficas. */
export const categoryColor: Record<BlockCategory, string> = {
  entrada: '#2E9E68',
  digitalizacion: '#2F6FEB',
  'forma-de-onda': '#7C4DDB',
  voz: '#C2255C',
  perceptual: '#D9480F',
  'sin-perdidas': '#0B8A8A',
  canal: '#5C6B80',
  piezas: '#5F3DC4',
  utilidades: '#8C6D1F',
  salida: '#1F2A44',
};

export const categoryOrder: BlockCategory[] = [
  'entrada',
  'digitalizacion',
  'forma-de-onda',
  'voz',
  'perceptual',
  'sin-perdidas',
  'canal',
  'piezas',
  'utilidades',
  'salida',
];

/** Color de cable por tipo de dato. La forma del conector también cambia (círculo/cuadrado). */
export const portColor: Record<PortType, string> = {
  signal: '#2F6FEB',
  bitstream: '#E09A00',
  packets: '#0E9F6E',
  frames: '#9C36B5',
};

export const inputSeriesColor = '#9AA6B8';
export const errorSeriesColor = '#D6336C';

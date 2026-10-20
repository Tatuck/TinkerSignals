import type { BlockCategory, PortType } from '@/engine/types';

/** Color de cada categoría: cabecera del bloque, trazo de "salida" en sus gráficas. */
export const categoryColor: Record<BlockCategory, string> = {
  entrada: '#2E9E68',
  digitalizacion: '#2F6FEB',
  diferencial: '#7C4DDB',
  transformada: '#D9480F',
  'sin-perdidas': '#0B8A8A',
  voz: '#C2255C',
  canal: '#5C6B80',
  utilidades: '#8C6D1F',
  salida: '#1F2A44',
};

export const categoryOrder: BlockCategory[] = [
  'entrada',
  'digitalizacion',
  'diferencial',
  'transformada',
  'sin-perdidas',
  'voz',
  'canal',
  'utilidades',
  'salida',
];

/** Color de cable por tipo de dato. La forma del conector también cambia (círculo/cuadrado). */
export const portColor: Record<PortType, string> = {
  signal: '#2F6FEB',
  bitstream: '#E09A00',
};

export const inputSeriesColor = '#9AA6B8';
export const errorSeriesColor = '#D6336C';

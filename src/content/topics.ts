import type { Audience, Level, Topic, TopicId } from './types';

/**
 * Temas del catálogo, en el orden en que conviene estudiarlos. Cada ficha
 * de teoría pertenece a un tema (el de la lista `concepts` donde aparece);
 * ejemplos, lecciones y problemas declaran el suyo en sus metadatos.
 */
export const topics: Topic[] = [
  {
    id: 'muestreo',
    title: 'Señales y muestreo',
    summary: 'Qué es una señal, su espectro, cómo se muestrea y qué es el aliasing.',
    concepts: ['senales', 'muestreo', 'aliasing', 'fft', 'filtros'],
  },
  {
    id: 'cuantizacion',
    title: 'Cuantización y PCM',
    summary: 'Pasar de valores continuos a niveles: ruido de cuantización, ley μ/A y G.711.',
    concepts: ['cuantizacion', 'no-uniforme', 'pcm'],
  },
  {
    id: 'prediccion',
    title: 'Predicción: DPCM y ADPCM',
    summary: 'Enviar solo lo que no se puede adivinar: el error de predicción.',
    concepts: ['prediccion', 'dpcm'],
  },
  {
    id: 'sin-perdidas',
    title: 'Compresión sin pérdidas',
    summary: 'Entropía, Huffman, codificación aritmética, LZW y RLE.',
    concepts: ['entropia', 'huffman', 'aritmetica', 'lzw'],
  },
  {
    id: 'voz',
    title: 'Voz: LPC y CELP',
    summary: 'El modelo fuente-filtro: sonoro/sordo, pitch, ganancia y coeficientes.',
    concepts: ['tramas', 'fuente-filtro', 'celp'],
  },
  {
    id: 'perceptual',
    title: 'Audio perceptual',
    summary: 'Transformadas, subbandas y enmascaramiento: lo que el oído no oye.',
    concepts: ['dct', 'subbandas', 'perceptual'],
  },
  {
    id: 'imagen',
    title: 'Imagen y JPEG',
    summary: 'Píxeles, YCbCr, submuestreo de color, DCT 8×8, cuantización y entropía.',
    concepts: ['imagen-digital', 'ycbcr', 'dct-2d', 'jpeg'],
  },
  {
    id: 'red',
    title: 'Canal y red',
    summary: 'Errores de bit, paquetes, retardo, jitter y pérdidas en una llamada.',
    concepts: ['canal', 'retardo', 'voip', 'jitter'],
  },
  {
    id: 'calidad',
    title: 'Calidad y medidas',
    summary: 'SNR, SNR segmental, PSNR, SSIM y MOS: cómo medir lo bien que suena o se ve.',
    concepts: ['snr', 'calidad-imagen'],
  },
  {
    id: 'esteganografia',
    title: 'Esteganografía',
    summary: 'Esconder un mensaje dentro de una foto o de una voz sin que se note.',
    concepts: ['esteganografia'],
  },
];

export const levels: { id: Level; title: string }[] = [
  { id: 'basico', title: 'Básico' },
  { id: 'intermedio', title: 'Intermedio' },
  { id: 'avanzado', title: 'Avanzado' },
];

export const audiences: { id: Audience; title: string }[] = [
  { id: 'estudiar', title: 'Para estudiar' },
  { id: 'curiosear', title: 'Para curiosear' },
  { id: 'probar', title: 'Para probar rápido' },
];

export const topicById = (id: TopicId): Topic | undefined => topics.find((t) => t.id === id);

/** Tema de una ficha de teoría. */
export function topicOfConcept(conceptId: string): TopicId | undefined {
  return topics.find((t) => t.concepts.includes(conceptId))?.id;
}

const topicIndex = (id: TopicId) => topics.findIndex((t) => t.id === id);
const levelIndex = (id: Level) => levels.findIndex((l) => l.id === id);

/** Orden de estudio: tema, nivel y después el orden propio. */
export function byStudyOrder(
  a: { topic: TopicId; level: Level; order?: number },
  b: { topic: TopicId; level: Level; order?: number },
): number {
  return (
    topicIndex(a.topic) - topicIndex(b.topic) ||
    levelIndex(a.level) - levelIndex(b.level) ||
    (a.order ?? 50) - (b.order ?? 50)
  );
}

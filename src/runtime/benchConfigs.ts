import type { ParamValue } from '@/engine/types';

/**
 * Familias de códecs para el comparador tasa–calidad: cada una barre un
 * ajuste y da un punto (kbps, calidad) por valor.
 */
export interface BenchFamily {
  id: string;
  title: string;
  encoder: string;
  decoder: string;
  /** Ajustes fijos. */
  base: Record<string, ParamValue>;
  /** Parámetro que se barre y sus valores. */
  sweep: { param: string; values: ParamValue[]; label: (v: ParamValue) => string };
  /** Se recomienda para voz (8–16 kHz) o para cualquier señal. */
  kind: 'voz' | 'general';
}

export const BENCH_FAMILIES: BenchFamily[] = [
  {
    id: 'pcm-linear',
    title: 'PCM lineal',
    encoder: 'pcm-encoder',
    decoder: 'pcm-decoder',
    base: { law: 'linear' },
    sweep: { param: 'bits', values: [3, 4, 6, 8, 10, 12], label: (v) => `${v} bits` },
    kind: 'general',
  },
  {
    id: 'pcm-mu',
    title: 'PCM ley μ',
    encoder: 'pcm-encoder',
    decoder: 'pcm-decoder',
    base: { law: 'mu' },
    sweep: { param: 'bits', values: [3, 4, 5, 6, 7, 8], label: (v) => `${v} bits` },
    kind: 'general',
  },
  {
    id: 'dpcm',
    title: 'DPCM',
    encoder: 'dpcm-encoder',
    decoder: 'dpcm-decoder',
    base: { order: 8 },
    sweep: { param: 'bits', values: [2, 3, 4, 5, 6], label: (v) => `${v} bits` },
    kind: 'general',
  },
  {
    id: 'subband',
    title: 'Subbandas (tipo G.722)',
    encoder: 'subband-encoder',
    decoder: 'subband-decoder',
    base: {},
    sweep: { param: 'mode', values: ['48', '56', '64'], label: (v) => `modo ${v}` },
    kind: 'voz',
  },
  {
    id: 'mpeg1',
    title: 'MPEG-1 Layer I',
    encoder: 'mpeg1-encoder',
    decoder: 'mpeg1-decoder',
    base: { psychoacoustic: true },
    sweep: {
      param: 'bitrate',
      values: ['32', '64', '96', '128', '192', '256'],
      label: (v) => `${v} kbps`,
    },
    kind: 'general',
  },
  {
    id: 'celp',
    title: 'CELP',
    encoder: 'celp-encoder',
    decoder: 'celp-decoder',
    base: {},
    sweep: {
      param: 'codebookSize',
      values: ['16', '64', '256', '1024'],
      label: (v) => `codebook ${v}`,
    },
    kind: 'voz',
  },
  {
    id: 'lpc',
    title: 'Vocoder LPC',
    encoder: 'lpc-encoder',
    decoder: 'lpc-decoder',
    base: {},
    sweep: { param: 'kBits', values: [3, 4, 5, 6, 8], label: (v) => `${v} bits/coef.` },
    kind: 'voz',
  },
];

export interface BenchPoint {
  family: string;
  value: ParamValue;
  bitrate: number;
  snr: number;
  snrSeg: number;
  lsd: number;
  computeMs: number;
  error?: string;
}

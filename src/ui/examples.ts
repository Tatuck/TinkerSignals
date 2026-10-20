import { defaultParams } from '@/engine/registry';
import type { ParamValue } from '@/engine/types';
import { registry } from './registry';
import type { BlockNode, CableEdge } from './store';

/**
 * Circuitos de ejemplo. Cada uno es un pequeño experimento guiado: se cargan
 * desde el menú "Ejemplos" de la barra superior.
 */
export interface Example {
  id: string;
  title: string;
  description: string;
  nodes: { id: string; type: string; x: number; y: number; params?: Record<string, ParamValue> }[];
  /** [origen, puertoOrigen, destino, puertoDestino] */
  edges: [string, string, string, string][];
}

export const examples: Example[] = [
  {
    id: 'cuantizacion',
    title: 'Cuantización uniforme',
    description: 'Una vocal sintética cuantizada a 4 bits. Mueve los bits y escucha el ruido.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 80 },
      { id: 'q', type: 'quantizer-uniform', x: 340, y: 0, params: { bits: 4 } },
      { id: 'out', type: 'output', x: 700, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'q', 'in'],
      ['q', 'out', 'out', 'in'],
      ['gen', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'mi-voz',
    title: 'Tu voz con pocos bits',
    description: 'Graba tu voz y escúchala con 3 bits por muestra frente al original.',
    nodes: [
      { id: 'mic', type: 'microphone', x: 0, y: 80 },
      { id: 'q', type: 'quantizer-uniform', x: 340, y: 0, params: { bits: 3, mode: 'midtread' } },
      { id: 'out', type: 'output', x: 700, y: 60 },
    ],
    edges: [
      ['mic', 'out', 'q', 'in'],
      ['q', 'out', 'out', 'in'],
      ['mic', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'g711',
    title: 'G.711: PCM ley μ a 8 kHz',
    description: 'El códec de la telefonía clásica: 8 kHz × 8 bits = 64 kbps.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 80, params: { sampleRate: '16000' } },
      { id: 'rs', type: 'resampler', x: 320, y: 60, params: { sampleRate: '8000' } },
      { id: 'enc', type: 'pcm-encoder', x: 640, y: 40, params: { bits: 8, law: 'mu' } },
      { id: 'dec', type: 'pcm-decoder', x: 960, y: 80 },
      { id: 'out', type: 'output', x: 1260, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'rs', 'in'],
      ['rs', 'out', 'enc', 'in'],
      ['enc', 'out', 'dec', 'in'],
      ['dec', 'out', 'out', 'in'],
      ['rs', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'aliasing',
    title: 'Aliasing al remuestrear',
    description: 'Un barrido bajado a 4 kHz con y sin filtro antialiasing.',
    nodes: [
      {
        id: 'gen',
        type: 'generator',
        x: 0,
        y: 140,
        params: { waveform: 'chirp', frequency: 100, duration: 4, amplitude: 0.5 },
      },
      {
        id: 'aa',
        type: 'resampler',
        x: 340,
        y: 0,
        params: { sampleRate: '4000', antialias: true },
      },
      {
        id: 'noaa',
        type: 'resampler',
        x: 340,
        y: 300,
        params: { sampleRate: '4000', antialias: false },
      },
      { id: 'o1', type: 'output', x: 700, y: 0 },
      { id: 'o2', type: 'output', x: 700, y: 300 },
    ],
    edges: [
      ['gen', 'out', 'aa', 'in'],
      ['gen', 'out', 'noaa', 'in'],
      ['aa', 'out', 'o1', 'in'],
      ['noaa', 'out', 'o2', 'in'],
    ],
  },
  {
    id: 'dpcm-vs-pcm',
    title: 'DPCM frente a PCM con 4 bits',
    description: 'Mismos bits por muestra; la predicción marca la diferencia.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 180 },
      { id: 'denc', type: 'dpcm-encoder', x: 320, y: 0, params: { bits: 4, order: 4 } },
      { id: 'ddec', type: 'dpcm-decoder', x: 640, y: 30 },
      { id: 'penc', type: 'pcm-encoder', x: 320, y: 360, params: { bits: 4, law: 'linear' } },
      { id: 'pdec', type: 'pcm-decoder', x: 640, y: 390 },
      { id: 'c1', type: 'comparator', x: 960, y: 0 },
      { id: 'c2', type: 'comparator', x: 960, y: 360 },
    ],
    edges: [
      ['gen', 'out', 'denc', 'in'],
      ['denc', 'out', 'ddec', 'in'],
      ['gen', 'out', 'penc', 'in'],
      ['penc', 'out', 'pdec', 'in'],
      ['gen', 'out', 'c1', 'reference'],
      ['ddec', 'out', 'c1', 'test'],
      ['gen', 'out', 'c2', 'reference'],
      ['pdec', 'out', 'c2', 'test'],
    ],
  },
  {
    id: 'adpcm-canal',
    title: 'ADPCM por un canal con errores',
    description: '32 kbps a 8 kHz y cómo se recupera de los bits erróneos.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 80, params: { sampleRate: '8000', frequency: 180 } },
      { id: 'enc', type: 'adpcm-encoder', x: 320, y: 40 },
      { id: 'ch', type: 'bit-errors', x: 640, y: 60, params: { ber: 0.001 } },
      { id: 'dec', type: 'adpcm-decoder', x: 960, y: 80 },
      { id: 'out', type: 'output', x: 1260, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'enc', 'in'],
      ['enc', 'out', 'ch', 'in'],
      ['ch', 'out', 'dec', 'in'],
      ['dec', 'out', 'out', 'in'],
      ['gen', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'huffman',
    title: 'DPCM + Huffman',
    description:
      'El error de predicción se concentra en pocos valores: Huffman lo aprovecha sin perder nada.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 80 },
      { id: 'enc', type: 'dpcm-encoder', x: 320, y: 40, params: { bits: 6, order: 2 } },
      { id: 'h', type: 'huffman-encoder', x: 640, y: 20 },
      { id: 'hd', type: 'huffman-decoder', x: 960, y: 60 },
      { id: 'dec', type: 'dpcm-decoder', x: 1260, y: 80 },
      { id: 'out', type: 'output', x: 1560, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'enc', 'in'],
      ['enc', 'out', 'h', 'in'],
      ['h', 'out', 'hd', 'in'],
      ['hd', 'out', 'dec', 'in'],
      ['dec', 'out', 'out', 'in'],
      ['gen', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'transformada',
    title: 'Transformada: compresión frente a retardo',
    description: 'Bloques grandes comprimen mejor, pero hay que esperar a llenarlos.',
    nodes: [
      { id: 'gen', type: 'generator', x: 0, y: 80 },
      {
        id: 'tc',
        type: 'transform-codec',
        x: 320,
        y: 20,
        params: { blockSize: '256', keep: 20, bits: 6 },
      },
      { id: 'out', type: 'output', x: 680, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'tc', 'in'],
      ['tc', 'out', 'out', 'in'],
      ['gen', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'vocoder-lpc',
    title: 'Vocoder LPC: voz a 3 kbps',
    description: 'Análisis de voz y vocoder LPC: voz inteligible a unos 3 kbps.',
    nodes: [
      {
        id: 'gen',
        type: 'generator',
        x: 0,
        y: 120,
        params: { sampleRate: '8000', frequency: 120 },
      },
      { id: 'va', type: 'voice-analysis', x: 320, y: 100 },
      { id: 'enc', type: 'lpc-encoder', x: 640, y: 40 },
      { id: 'dec', type: 'lpc-decoder', x: 960, y: 80 },
      { id: 'out', type: 'output', x: 1280, y: 60 },
    ],
    edges: [
      ['gen', 'out', 'va', 'in'],
      ['va', 'out', 'enc', 'in'],
      ['enc', 'out', 'dec', 'in'],
      ['dec', 'out', 'out', 'in'],
      ['gen', 'out', 'out', 'reference'],
    ],
  },
  {
    id: 'celp-vs-lpc',
    title: 'CELP frente a vocoder LPC',
    description: 'La misma voz por un vocoder LPC y por CELP: tasa, error y cómo suenan.',
    nodes: [
      {
        id: 'gen',
        type: 'generator',
        x: 0,
        y: 200,
        params: { sampleRate: '8000', frequency: 120 },
      },
      { id: 'cenc', type: 'celp-encoder', x: 320, y: 0 },
      { id: 'cdec', type: 'celp-decoder', x: 660, y: 40 },
      { id: 'lenc', type: 'lpc-encoder', x: 320, y: 440 },
      { id: 'ldec', type: 'lpc-decoder', x: 660, y: 480 },
      { id: 'c1', type: 'comparator', x: 980, y: 0 },
      { id: 'c2', type: 'comparator', x: 980, y: 440 },
      { id: 'o1', type: 'output', x: 1300, y: 0 },
      { id: 'o2', type: 'output', x: 1300, y: 440 },
    ],
    edges: [
      ['gen', 'out', 'cenc', 'in'],
      ['cenc', 'out', 'cdec', 'in'],
      ['gen', 'out', 'lenc', 'in'],
      ['lenc', 'out', 'ldec', 'in'],
      ['gen', 'out', 'c1', 'reference'],
      ['cdec', 'out', 'c1', 'test'],
      ['gen', 'out', 'c2', 'reference'],
      ['ldec', 'out', 'c2', 'test'],
      ['cdec', 'out', 'o1', 'in'],
      ['gen', 'out', 'o1', 'reference'],
      ['ldec', 'out', 'o2', 'in'],
      ['gen', 'out', 'o2', 'reference'],
    ],
  },
  {
    id: 'tu-voz-celp',
    title: 'Tu voz por CELP a 8 kHz',
    description: 'Graba tu voz, pásala a 8 kHz y codifícala con CELP.',
    nodes: [
      { id: 'mic', type: 'microphone', x: 0, y: 80 },
      { id: 'rs', type: 'resampler', x: 320, y: 60, params: { sampleRate: '8000' } },
      { id: 'enc', type: 'celp-encoder', x: 640, y: 20 },
      { id: 'dec', type: 'celp-decoder', x: 980, y: 60 },
      { id: 'out', type: 'output', x: 1300, y: 40 },
    ],
    edges: [
      ['mic', 'out', 'rs', 'in'],
      ['rs', 'out', 'enc', 'in'],
      ['enc', 'out', 'dec', 'in'],
      ['dec', 'out', 'out', 'in'],
      ['rs', 'out', 'out', 'reference'],
    ],
  },
];

/** Convierte un ejemplo en nodos y cables del lienzo (descarta los que usen bloques que no existan). */
export function instantiate(ex: Example): { nodes: BlockNode[]; edges: CableEdge[] } {
  const nodes: BlockNode[] = ex.nodes
    .filter((n) => registry.get(n.type))
    .map((n) => ({
      id: n.id,
      type: 'block',
      position: { x: n.x, y: n.y },
      data: {
        blockType: n.type,
        params: { ...defaultParams(registry.get(n.type)!.params), ...n.params },
      },
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: CableEdge[] = ex.edges
    .filter(([s, , d]) => ids.has(s) && ids.has(d))
    .map(([s, sp, d, dp], i) => ({
      id: `${ex.id}-e${i}`,
      type: 'cable',
      source: s,
      sourceHandle: sp,
      target: d,
      targetHandle: dp,
    }));
  return { nodes, edges };
}

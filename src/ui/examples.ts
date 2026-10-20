import { defaultParams } from '@/engine/registry';
import type { ParamValue } from '@/engine/types';
import { registry } from './registry';
import type { BlockNode, CableEdge } from './store';

/**
 * Circuitos de ejemplo. Cada uno es una pequeña práctica guiada: se cargan
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
];

/** Convierte un ejemplo en nodos y cables del lienzo (descarta los que usen bloques que no existan). */
export function instantiate(ex: Example): { nodes: BlockNode[]; edges: CableEdge[] } {
  const nodes: BlockNode[] = ex.nodes
    .filter((n) => registry.get(n.type))
    .map((n) => ({
      id: n.id,
      type: 'block',
      position: { x: n.x, y: n.y },
      data: { blockType: n.type, params: { ...defaultParams(registry.get(n.type)!.params), ...n.params } },
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

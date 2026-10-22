import { defaultParams } from '@/engine/registry';
import type { Circuit } from '@/content/types';
import { registry } from './registry';
import type { BlockNode, CableEdge } from './store';

export { DEFAULT_EXAMPLE, exampleById, examples } from '@/content';
export type { Example } from '@/content/types';

/**
 * Convierte un circuito descrito como datos (un ejemplo, el de un problema)
 * en nodos y cables del lienzo. Descarta los que usen bloques que no existan.
 */
export function instantiate(ex: Circuit & { id?: string }): {
  nodes: BlockNode[];
  edges: CableEdge[];
} {
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
      id: `${ex.id ?? 'c'}-e${i}`,
      type: 'cable',
      source: s,
      sourceHandle: sp,
      target: d,
      targetHandle: dp,
    }));
  return { nodes, edges };
}

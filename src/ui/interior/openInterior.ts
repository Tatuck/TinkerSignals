import { defaultParams, resolveParams } from '@/engine/registry';
import type { InteriorInputs } from '@/engine/types';
import { engine } from '@/runtime/client';
import { registry } from '../registry';
import { createGraphStore, invalidate, useStore, type BlockNode, type CableEdge } from '../store';

/** Circuito del interior que se está viendo (solo hay uno abierto a la vez). */
export const interiorStore = createGraphStore('interior');

/**
 * Monta el interior de un bloque del circuito principal: construye su
 * circuito de piezas básicas, le pasa las mismas entradas que recibe el
 * bloque real y lo ejecuta en el motor «interior» del Worker.
 */
export async function openInterior(nodeId: string): Promise<void> {
  const main = useStore.getState();
  const node = main.nodes.find((n) => n.id === nodeId);
  const def = node && registry.get(node.data.blockType);
  if (!node || !def?.interior) return;

  const inputs: InteriorInputs = {};
  for (const port of Object.keys(def.inputs)) {
    const e = main.edges.find((x) => x.target === nodeId && x.targetHandle === port);
    inputs[port] = e ? main.results?.nodes[e.source]?.outputs[e.sourceHandle ?? '']?.summary : undefined;
  }
  const g = def.interior(resolveParams(def.params, node.data.params) as never, inputs);
  const portOf = new Map(Object.entries(g.inputs).map(([port, id]) => [id, port]));

  const nodes: BlockNode[] = g.nodes.map((n) => {
    const d = registry.get(n.type)!;
    const params = { ...defaultParams(d.params), ...n.params };
    if (portOf.has(n.id)) params.port = portOf.get(n.id)!;
    return { id: n.id, type: 'block', position: { x: n.x, y: n.y }, data: { blockType: n.type, params } };
  });
  const edges: CableEdge[] = g.edges.map(([s, sp, d, dp], i) => ({
    id: `i${i}`,
    type: 'cable',
    source: s,
    sourceHandle: sp,
    target: d,
    targetHandle: dp,
  }));

  await engine.prepareInterior(nodeId, Object.keys(def.inputs));
  interiorStore.getState().load(nodes, edges);
  invalidate(interiorStore);
  useStore.setState({ interiorOf: nodeId, interiorOutputs: g.outputs });
}

export function closeInterior(): void {
  useStore.setState({ interiorOf: null, interiorOutputs: {} });
  interiorStore.getState().load([], []);
}

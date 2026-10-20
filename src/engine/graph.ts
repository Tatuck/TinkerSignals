import type { BlockRegistry } from './registry';
import type { Graph, GraphEdge, RunResult } from './types';

export type GraphError = RunResult['graphErrors'][number];

export interface ValidatedGraph {
  /** Nodos en orden de ejecución (las fuentes primero). */
  order: string[];
  /** Cables válidos indexados por "nodo destino → puerto destino". */
  incoming: Map<string, Map<string, GraphEdge>>;
  errors: GraphError[];
}

/**
 * Comprueba el grafo y calcula el orden de ejecución.
 * Los cables inválidos se ignoran (y se informan) en lugar de abortar:
 * un cable mal puesto no debe impedir que funcione el resto del circuito.
 */
export function validateGraph(graph: Graph, registry: BlockRegistry): ValidatedGraph {
  const errors: GraphError[] = [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, Map<string, GraphEdge>>();

  for (const n of graph.nodes) {
    if (!registry.get(n.type)) {
      errors.push({ nodeId: n.id, message: `Tipo de bloque desconocido: "${n.type}"` });
    }
    incoming.set(n.id, new Map());
  }

  for (const e of graph.edges) {
    const problem = checkEdge(e, graph, registry);
    if (problem) {
      errors.push({ edgeId: e.id, message: problem });
      continue;
    }
    const ports = incoming.get(e.target)!;
    if (ports.has(e.targetPort)) {
      errors.push({ edgeId: e.id, message: `La entrada "${e.targetPort}" ya tiene un cable` });
      continue;
    }
    ports.set(e.targetPort, e);
  }

  // Orden topológico (Kahn). Lo que quede sin ordenar forma parte de un ciclo.
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    indegree.set(id, 0);
    outgoing.set(id, []);
  }
  for (const [target, ports] of incoming) {
    for (const e of ports.values()) {
      indegree.set(target, indegree.get(target)! + 1);
      outgoing.get(e.source)!.push(target);
    }
  }
  const queue = [...nodes.keys()].filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id)!) {
      const d = indegree.get(next)! - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  for (const id of nodes.keys()) {
    if (!order.includes(id)) {
      errors.push({ nodeId: id, message: 'El bloque forma parte de un bucle; no se puede ejecutar' });
    }
  }

  return { order, incoming, errors };
}

function checkEdge(e: GraphEdge, graph: Graph, registry: BlockRegistry): string | null {
  const src = graph.nodes.find((n) => n.id === e.source);
  const dst = graph.nodes.find((n) => n.id === e.target);
  if (!src || !dst) return 'El cable apunta a un bloque que no existe';
  const srcDef = registry.get(src.type);
  const dstDef = registry.get(dst.type);
  if (!srcDef || !dstDef) return 'El cable conecta un bloque desconocido';
  const out = srcDef.outputs[e.sourcePort];
  const inp = dstDef.inputs[e.targetPort];
  if (!out) return `El bloque no tiene salida "${e.sourcePort}"`;
  if (!inp) return `El bloque no tiene entrada "${e.targetPort}"`;
  if (out.type !== inp.type) return `Tipos incompatibles: ${out.type} → ${inp.type}`;
  return null;
}

/** ¿Se puede conectar esta salida a esta entrada? La UI lo usa al arrastrar cables. */
export function canConnect(
  registry: BlockRegistry,
  sourceType: string,
  sourcePort: string,
  targetType: string,
  targetPort: string,
): boolean {
  const out = registry.get(sourceType)?.outputs[sourcePort];
  const inp = registry.get(targetType)?.inputs[targetPort];
  return !!out && !!inp && out.type === inp.type;
}

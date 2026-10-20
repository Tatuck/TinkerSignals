import { BlockWaiting } from './errors';
import { validateGraph } from './graph';
import { resolveParams, type BlockRegistry } from './registry';
import { summarize } from './summary';
import type {
  Graph,
  GraphNode,
  NodeResult,
  PortValue,
  RunResult,
  Signal,
} from './types';

interface CacheEntry {
  key: string;
  outputs: Record<string, PortValue>;
  /** Retardo acumulado en cada salida. */
  outLatency: Record<string, number>;
  result: NodeResult;
}

/**
 * Ejecuta grafos de bloques.
 *
 * - Ejecuta los nodos en orden topológico.
 * - Cachea cada nodo con una clave que depende de su tipo, sus parámetros y
 *   las claves de los nodos que lo alimentan: si cambias un parámetro solo
 *   se recalcula ese nodo y lo que hay aguas abajo.
 * - Si un bloque falla, solo ese nodo (y los que dependen de él) quedan
 *   marcados; el resto del grafo se ejecuta igual.
 * - Guarda los valores de cada puerto para que la UI pueda "sondear" los cables.
 */
export class Engine {
  private cache = new Map<string, CacheEntry>();
  private assets = new Map<string, { signal: Signal; version: number }>();
  private assetCounter = 0;

  constructor(private readonly registry: BlockRegistry) {}

  /** Registra (o reemplaza) un audio externo: archivo cargado o grabación. */
  setAsset(id: string, signal: Signal): void {
    this.assets.set(id, { signal, version: ++this.assetCounter });
  }

  deleteAsset(id: string): void {
    this.assets.delete(id);
  }

  /** Valor completo que salió por un puerto en la última ejecución. */
  getValue(nodeId: string, port: string): PortValue | undefined {
    return this.cache.get(nodeId)?.outputs[port];
  }

  /** Valor que entró por un puerto en la última ejecución (útil para bloques sumidero). */
  getInputValue(nodeId: string, port: string): PortValue | undefined {
    const edge = this.lastIncoming.get(nodeId)?.get(port);
    return edge ? this.getValue(edge.source, edge.sourcePort) : undefined;
  }

  private lastIncoming = new Map<string, Map<string, { source: string; sourcePort: string }>>();

  run(graph: Graph): RunResult {
    const t0 = now();
    const { order, incoming, errors } = validateGraph(graph, this.registry);
    this.lastIncoming = incoming;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const nodes: RunResult['nodes'] = {};
    const alive = new Set<string>();

    for (const id of order) {
      const node = byId.get(id)!;
      const { entry, result } = this.evaluateNode(node, incoming.get(id)!);
      nodes[id] = result;
      if (entry) {
        this.cache.set(id, entry);
        alive.add(id);
      }
    }

    // Nodos que no llegaron a ordenarse (ciclos o tipos desconocidos).
    for (const n of graph.nodes) {
      if (!nodes[n.id]) {
        const msg = errors.find((e) => e.nodeId === n.id)?.message ?? 'No se pudo ejecutar';
        nodes[n.id] = emptyResult('error', msg);
      }
    }

    // Olvida nodos que ya no existen en el grafo.
    for (const id of this.cache.keys()) if (!alive.has(id)) this.cache.delete(id);

    return { nodes, graphErrors: errors, totalMs: now() - t0 };
  }

  private evaluateNode(
    node: GraphNode,
    ports: Map<string, { source: string; sourcePort: string }>,
  ): { entry?: CacheEntry; result: NodeResult } {
    const def = this.registry.get(node.type);
    if (!def) {
      return { result: emptyResult('error', `Tipo de bloque desconocido: "${node.type}"`) };
    }

    // Reúne entradas, sus claves de caché y su retardo acumulado.
    const inputs: Record<string, PortValue | undefined> = {};
    const inputKeys: string[] = [];
    const missing: string[] = [];
    let upstreamLatency = 0;
    let upstreamFailed = false;

    for (const [name, spec] of Object.entries(def.inputs)) {
      const edge = ports.get(name);
      const src = edge && this.cache.get(edge.source);
      const value = edge && src?.outputs[edge.sourcePort];
      if (edge && !value) upstreamFailed = true;
      if (!edge || !src || !value) {
        if (!spec.optional) missing.push(name);
        inputKeys.push(`${name}:-`);
        continue;
      }
      inputs[name] = value;
      inputKeys.push(`${name}:${src.key}/${edge.sourcePort}`);
      upstreamLatency = Math.max(upstreamLatency, src.outLatency[edge.sourcePort] ?? 0);
    }

    if (missing.length) {
      const r = emptyResult(
        'waiting',
        upstreamFailed ? 'Un bloque anterior no ha producido salida' : undefined,
      );
      r.missingInputs = missing;
      return { result: r };
    }

    const params = resolveParams(def.params, node.params);
    const assetVersions = Object.entries(def.params)
      .filter(([, s]) => s.type === 'audio')
      .map(([k]) => {
        const id = params[k] as string | null;
        return `${k}=${id ? (this.assets.get(id)?.version ?? 'missing') : 'none'}`;
      });
    const key = stableHash([node.type, params, inputKeys, assetVersions]);

    const prev = this.cache.get(node.id);
    if (prev && prev.key === key) {
      return { entry: prev, result: { ...prev.result, cached: true, computeMs: 0 } };
    }

    const t0 = now();
    try {
      const res = def.process({
        inputs: inputs as never,
        params: params as never,
        getAsset: (id) => this.assets.get(id)?.signal,
      });
      const computeMs = now() - t0;
      const own = res.latencyMs ?? 0;
      const outLatency: Record<string, number> = {};
      const outputs: NodeResult['outputs'] = {};
      for (const port of Object.keys(def.outputs)) {
        const v = res.outputs[port];
        if (!v) throw new Error(`El bloque no devolvió la salida "${port}"`);
        if (v.kind !== def.outputs[port].type) {
          throw new Error(`La salida "${port}" debía ser ${def.outputs[port].type} y es ${v.kind}`);
        }
        outLatency[port] = upstreamLatency + own;
        outputs[port] = { summary: summarize(v), latencyMs: outLatency[port] };
      }
      const result: NodeResult = {
        status: 'ok',
        metrics: res.metrics ?? [],
        plots: res.plots ?? [],
        ownLatencyMs: own,
        outputs,
        computeMs,
        cached: false,
      };
      return { entry: { key, outputs: res.outputs, outLatency, result }, result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = err instanceof BlockWaiting ? 'waiting' : 'error';
      return { result: { ...emptyResult(status, msg), computeMs: now() - t0 } };
    }
  }
}

function emptyResult(status: NodeResult['status'], error?: string): NodeResult {
  return {
    status,
    error,
    metrics: [],
    plots: [],
    ownLatencyMs: 0,
    outputs: {},
    computeMs: 0,
    cached: false,
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Hash estable (FNV-1a sobre JSON con claves ordenadas). Suficiente para claves de caché. */
export function stableHash(value: unknown): string {
  const json = JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

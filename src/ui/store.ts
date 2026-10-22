import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { createContext, useContext } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { canConnect } from '@/engine/graph';
import { defaultParams } from '@/engine/registry';
import type { Graph, ParamValue, RunResult } from '@/engine/types';
import { engine, type Scope } from '@/runtime/client';
import { registry } from './registry';

export interface BlockNodeData extends Record<string, unknown> {
  blockType: string;
  params: Record<string, ParamValue>;
}

export type BlockNode = Node<BlockNodeData, 'block'>;
export type CableEdge = Edge<Record<string, unknown>, 'cable'>;

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

export interface AssetInfo {
  name: string;
  /** Audio: duración y frecuencia de muestreo. */
  durationS?: number;
  sampleRate?: number;
  trimmedS?: number;
  /** Imagen: tamaño en píxeles. */
  width?: number;
  height?: number;
}

export interface State {
  /** Qué circuito es: el principal o el interior de un bloque. */
  scope: Scope;
  nodes: BlockNode[];
  edges: CableEdge[];
  selection: Selection;
  results: RunResult | null;
  running: boolean;
  assets: Record<string, AssetInfo>;
  /** Se incrementa al cargar un circuito entero: el lienzo lo usa para encuadrarlo. */
  loadCount: number;
  /** ¿Está abierto el comparador tasa–calidad? */
  bench: boolean;
  /** ¿Está abierto el catálogo «Explorar»? (Sus filtros viven en `explore/open.ts`.) */
  explore: boolean;
  /**
   * Ficha de teoría abierta (id) o null. Las fichas se leen dentro de
   * Explorar: poner un id aquí lo abre en esa ficha.
   */
  theory: string | null;
  /** Instante elegido con la lupa temporal (s), o null si no hay lupa. */
  cursor: number | null;
  setCursor(t: number | null): void;
  /** Bloque cuyo interior se está viendo (solo en el circuito principal). */
  interiorOf: string | null;
  /** Qué nodo y puerto del interior corresponden a cada salida del bloque. */
  interiorOutputs: Record<string, [string, string]>;
  /** Mensaje breve en pantalla (p. ej. «Enlace copiado»). */
  toast: string | null;
  notify(message: string): void;

  onNodesChange(changes: NodeChange<BlockNode>[]): void;
  onEdgesChange(changes: EdgeChange<CableEdge>[]): void;
  onConnect(c: Connection): void;
  isValidConnection(c: Connection | Edge): boolean;
  addBlock(type: string, position: XYPosition): string;
  removeNode(id: string): void;
  duplicateNode(id: string): void;
  removeEdge(id: string): void;
  setParam(nodeId: string, key: string, value: ParamValue): void;
  select(s: Selection): void;
  registerAsset(id: string, info: AssetInfo): void;
  load(nodes: BlockNode[], edges: CableEdge[]): void;
}

/** Función que fuerza recalcular cada circuito (ver attachRunner). */
const runners = new Map<GraphStore, () => void>();

let counter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export type GraphStore = UseBoundStore<StoreApi<State>>;

/**
 * Crea un circuito con su propio estado y su propia ejecución en el Worker.
 * Hay uno principal y, al «entrar» en un bloque, otro para su interior.
 */
export function createGraphStore(scope: Scope): GraphStore {
  const store = create<State>((set, get) => ({
    scope,
    nodes: [],
    edges: [],
    selection: null,
    results: null,
    running: false,
    assets: {},
    loadCount: 0,
    toast: null,
    bench: false,
    explore: false,
    theory: null,
    cursor: null,
    setCursor: (cursor) => set({ cursor }),
    interiorOf: null,
    interiorOutputs: {},

    notify(message) {
      set({ toast: message });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), 3200);
    },

    onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
    onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

    isValidConnection(c) {
      const { nodes, edges } = get();
      const src = nodes.find((n) => n.id === c.source);
      const dst = nodes.find((n) => n.id === c.target);
      if (!src || !dst || !c.sourceHandle || !c.targetHandle || src.id === dst.id) return false;
      return (
        canConnect(
          registry,
          src.data.blockType,
          c.sourceHandle,
          dst.data.blockType,
          c.targetHandle,
        ) &&
        !edges.some(
          (e) =>
            e.target === c.target && e.targetHandle === c.targetHandle && e.id !== (c as Edge).id,
        )
      );
    },

    onConnect(c) {
      if (!get().isValidConnection(c)) return;
      set({ edges: addEdge({ ...c, id: newId('e'), type: 'cable' }, get().edges) as CableEdge[] });
    },

    addBlock(type, position) {
      const def = registry.get(type);
      if (!def) throw new Error(`Bloque desconocido: ${type}`);
      const id = newId('n');
      const node: BlockNode = {
        id,
        type: 'block',
        position,
        data: { blockType: type, params: defaultParams(def.params) },
      };
      set({ nodes: [...get().nodes, node], selection: { kind: 'node', id } });
      return id;
    },

    removeNode(id) {
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        selection: null,
      });
    },

    duplicateNode(id) {
      const n = get().nodes.find((x) => x.id === id);
      if (!n) return;
      const copy: BlockNode = {
        ...n,
        id: newId('n'),
        selected: false,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: { ...n.data, params: { ...n.data.params } },
      };
      set({ nodes: [...get().nodes, copy], selection: { kind: 'node', id: copy.id } });
    },

    removeEdge(id) {
      set({ edges: get().edges.filter((e) => e.id !== id), selection: null });
    },

    setParam(nodeId, key, value) {
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
            : n,
        ),
      });
    },

    select: (selection) => set({ selection }),

    registerAsset: (id, info) => set({ assets: { ...get().assets, [id]: info } }),

    load(nodes, edges) {
      set({ nodes, edges, selection: null, loadCount: get().loadCount + 1 });
    },
  }));
  attachRunner(store);
  return store;
}

export const useStore = createGraphStore('main');

/** Circuito al que pertenecen los componentes de este subárbol (principal por defecto). */
export const ScopeContext = createContext<GraphStore>(useStore);
export const useGraphStore = (): GraphStore => useContext(ScopeContext);

/** Lo que el motor necesita saber del lienzo (sin posiciones ni estado visual). */
export function toGraph(nodes: BlockNode[], edges: CableEdge[]): Graph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.blockType, params: n.data.params })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourcePort: e.sourceHandle ?? '',
      target: e.target,
      targetPort: e.targetHandle ?? '',
    })),
  };
}

// ─── Ejecución automática ───────────────────────────────────────────────────
// Cada vez que cambia algo que afecta al cálculo (no al mover bloques), se
// vuelve a ejecutar el grafo en el Worker. Si llega un cambio mientras se
// calcula, se ejecuta una sola vez más al terminar con el último estado.

/** Fuerza recalcular aunque el grafo no haya cambiado (p. ej. nuevo audio). */
export function invalidate(store: GraphStore = useStore): void {
  runners.get(store)?.();
}

function attachRunner(store: GraphStore): void {
  let lastSignature = '';
  let pending = false;
  let inFlight = false;
  let epoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const runLoop = async () => {
    inFlight = true;
    while (pending) {
      pending = false;
      const { nodes, edges, scope } = store.getState();
      store.setState({ running: true });
      try {
        const results = await engine.run(toGraph(nodes, edges), scope);
        store.setState({ results });
      } catch (err) {
        console.error('[motor] fallo inesperado', err);
      }
    }
    store.setState({ running: false });
    inFlight = false;
  };
  const schedule = () => {
    pending = true;
    if (!inFlight) void runLoop();
  };
  runners.set(store, () => {
    epoch++;
    schedule();
  });
  store.subscribe((s) => {
    const sig = JSON.stringify([toGraph(s.nodes, s.edges), epoch]);
    if (sig === lastSignature) return;
    lastSignature = sig;
    clearTimeout(timer);
    timer = setTimeout(schedule, 120);
  });
}

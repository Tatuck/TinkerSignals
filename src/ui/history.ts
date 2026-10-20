import { useStore, type BlockNode, type CableEdge } from './store';

/**
 * Deshacer/rehacer genérico: observa el circuito y, cuando deja de cambiar
 * durante un momento, guarda la versión anterior. Así cualquier cambio
 * (mover un deslizador, conectar, arrastrar un bloque) se puede deshacer
 * sin que cada acción tenga que acordarse de registrarse.
 */
interface Snapshot {
  nodes: BlockNode[];
  edges: CableEdge[];
}

const LIMIT = 100;
const past: Snapshot[] = [];
const future: Snapshot[] = [];
let committed: Snapshot = { nodes: [], edges: [] };
let committedSig = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let applying = false;
const listeners = new Set<() => void>();

const signature = (s: Snapshot) =>
  JSON.stringify([
    s.nodes.map((n) => [n.id, n.data, Math.round(n.position.x), Math.round(n.position.y)]),
    s.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle]),
  ]);

const clean = (s: Snapshot): Snapshot => ({
  nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
  edges: s.edges.map((e) => ({ ...e, selected: false })),
});

export function startHistory(): () => void {
  committed = clean(useStore.getState());
  committedSig = signature(committed);
  return useStore.subscribe((state) => {
    if (applying) return;
    const sig = signature(state);
    if (sig === committedSig) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      past.push(committed);
      if (past.length > LIMIT) past.shift();
      future.length = 0;
      committed = clean(useStore.getState());
      committedSig = signature(committed);
      listeners.forEach((l) => l());
    }, 350);
  });
}

function apply(s: Snapshot) {
  applying = true;
  useStore.setState({ nodes: s.nodes, edges: s.edges, selection: null });
  committed = s;
  committedSig = signature(s);
  applying = false;
  listeners.forEach((l) => l());
}

export function undo(): void {
  clearTimeout(timer);
  const current = clean(useStore.getState());
  if (signature(current) !== committedSig) {
    // Hay un cambio aún sin consolidar: deshacerlo a él primero.
    future.push(current);
    apply(committed);
    return;
  }
  const prev = past.pop();
  if (!prev) return;
  future.push(committed);
  apply(prev);
}

export function redo(): void {
  const next = future.pop();
  if (!next) return;
  past.push(committed);
  apply(next);
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
export function onHistoryChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

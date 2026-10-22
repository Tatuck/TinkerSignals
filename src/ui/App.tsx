import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { setAsset, setImageAsset } from '@/runtime/client';
import { Canvas } from './canvas/Canvas';
import { ErrorBoundary } from './ErrorBoundary';
import { DEFAULT_EXAMPLE, exampleById, instantiate } from './examples';
import { redo, startHistory, undo } from './history';
import { Inspector } from './inspector/Inspector';
import { InteriorView } from './interior/InteriorView';
import { loadAsset, pruneAssets } from './lib/assetDb';
import { decodeCircuit } from './lib/share';
import { Palette } from './palette/Palette';
import { registry } from './registry';
import { invalidate, useStore, type BlockNode, type CableEdge } from './store';
import { Toolbar } from './Toolbar';
import { BenchPanel } from './bench/BenchPanel';
import { ExplorePanel } from './explore/ExplorePanel';
import { ProblemPanel } from './problems/ProblemPanel';

const STORAGE_KEY = 'tinkersignals:circuit';

/**
 * Qué circuito se abre al entrar: el de un enlace compartido (#c=…), el
 * último del navegador o, si no hay ninguno, el primer ejemplo.
 * Devuelve true si venía de un enlace.
 */
async function restore(): Promise<boolean> {
  const { load } = useStore.getState();
  if (location.hash.startsWith('#c=')) {
    try {
      const g = await decodeCircuit(location.hash.slice(3));
      load(g.nodes, g.edges);
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch {
      useStore.getState().notify('El enlace está dañado; se abre tu último circuito.');
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { nodes, edges } = JSON.parse(raw) as { nodes: BlockNode[]; edges: CableEdge[] };
      if (nodes.length) {
        load(nodes, edges);
        await restoreAssets(nodes);
        return false;
      }
    }
  } catch {
    /* almacenamiento no disponible: seguimos con el ejemplo */
  }
  const g = instantiate(exampleById(DEFAULT_EXAMPLE)!);
  load(g.nodes, g.edges);
  return false;
}

/** Recupera de IndexedDB los audios que usan los bloques del circuito restaurado. */
async function restoreAssets(nodes: BlockNode[]) {
  const ids = new Set<string>();
  for (const n of nodes) {
    const def = registry.get(n.data.blockType);
    if (!def) continue;
    for (const [k, spec] of Object.entries(def.params)) {
      const v = n.data.params[k];
      if ((spec.type === 'audio' || spec.type === 'image') && typeof v === 'string') ids.add(v);
    }
  }
  for (const id of ids) {
    const a = await loadAsset(id);
    if (!a) continue;
    if (a.kind === 'image') {
      await setImageAsset(id, a.width, a.height, a.rgba);
      useStore.getState().registerAsset(id, { name: a.name, width: a.width, height: a.height });
      continue;
    }
    await setAsset(id, a.samples, a.sampleRate);
    useStore.getState().registerAsset(id, {
      name: a.name,
      durationS: a.samples.length / a.sampleRate,
      sampleRate: a.sampleRate,
      trimmedS: a.trimmedS,
    });
  }
  if (ids.size) invalidate();
  void pruneAssets(ids);
}

/** ¿El foco está en un campo donde las teclas deben escribir y no ejecutar atajos? */
const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
};

export function App() {
  useEffect(() => {
    let stopHistory = () => {};
    void restore().then(() => {
      stopHistory = startHistory();
    });
    let timer: ReturnType<typeof setTimeout>;
    const stopSave = useStore.subscribe((s) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const nodes = s.nodes.map(({ id, type, position, data }) => ({
            id,
            type,
            position,
            data,
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges: s.edges }));
        } catch {
          /* sin almacenamiento: no pasa nada */
        }
      }, 400);
    });

    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        redo();
      } else if (mod && key === 'd') {
        const sel = useStore.getState().selection;
        if (sel?.kind === 'node') {
          e.preventDefault();
          useStore.getState().duplicateNode(sel.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stopHistory();
      stopSave();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <ErrorBoundary label="la paleta">
          <Palette />
        </ErrorBoundary>
        <ErrorBoundary label="el lienzo">
          <Canvas />
        </ErrorBoundary>
        <ErrorBoundary label="el panel lateral">
          <Inspector />
        </ErrorBoundary>
      </div>
      <InteriorView />
      <BenchPanel />
      <ExplorePanel />
      <ProblemPanel />
      <Toast />
    </ReactFlowProvider>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
      {toast}
    </div>
  );
}

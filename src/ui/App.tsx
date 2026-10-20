import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { Canvas } from './canvas/Canvas';
import { ErrorBoundary } from './ErrorBoundary';
import { HOME_SEEN_KEY, Home } from './home/Home';
import { examples, instantiate } from './examples';
import { Inspector } from './inspector/Inspector';
import { Palette } from './palette/Palette';
import { useStore, type BlockNode, type CableEdge } from './store';
import { Toolbar } from './Toolbar';

const STORAGE_KEY = 'tinkersignals:circuit';

/** Restaura el último circuito del navegador o, si no hay, carga el primer ejemplo. */
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { nodes, edges } = JSON.parse(raw) as { nodes: BlockNode[]; edges: CableEdge[] };
      if (nodes.length) return useStore.getState().load(nodes, edges);
    }
  } catch {
    /* almacenamiento no disponible: seguimos con el ejemplo */
  }
  const g = instantiate(examples[0]);
  useStore.getState().load(g.nodes, g.edges);
}

function firstVisit(): boolean {
  try {
    return !localStorage.getItem(HOME_SEEN_KEY);
  } catch {
    return true;
  }
}

export function App() {
  const [home, setHome] = useState(firstVisit);
  const closeHome = () => {
    setHome(false);
    try {
      localStorage.setItem(HOME_SEEN_KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  };

  useEffect(() => {
    restore();
    let timer: ReturnType<typeof setTimeout>;
    return useStore.subscribe((s) => {
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
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar onHome={() => setHome(true)} />
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
      {home && <Home onClose={closeHome} />}
    </ReactFlowProvider>
  );
}

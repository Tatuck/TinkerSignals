import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { useEffect, useState } from 'react';
import { blockText } from '@/i18n';
import { engine } from '@/runtime/client';
import { edgeTypes, nodeTypes } from '../canvas/Canvas';
import { ErrorBoundary } from '../ErrorBoundary';
import { Inspector } from '../inspector/Inspector';
import { formatNumber } from '../lib/format';
import { registry } from '../registry';
import { ScopeContext, useStore } from '../store';
import { closeInterior, interiorStore } from './openInterior';

type Comparison = Awaited<ReturnType<typeof engine.compareInterior>>;

/**
 * «Por dentro» de un bloque: su circuito equivalente con piezas básicas,
 * ejecutado de verdad sobre la misma entrada. Se puede inspeccionar cada
 * cable y tocar las piezas sin que cambie el circuito principal.
 */
export function InteriorView() {
  const parentId = useStore((s) => s.interiorOf);
  const outputs = useStore((s) => s.interiorOutputs);
  const parent = useStore((s) => s.nodes.find((n) => n.id === s.interiorOf));
  const innerResults = interiorStore((s) => s.results);
  const [comparison, setComparison] = useState<Comparison>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeInterior();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Compara la salida del interior con la del bloque real cada vez que se recalcula.
  useEffect(() => {
    const entry = Object.entries(outputs)[0];
    if (!parentId || !entry || !innerResults) return;
    const [port, [node, innerPort]] = entry;
    let alive = true;
    void engine
      .compareInterior(parentId, port, node, innerPort)
      .then((c) => alive && setComparison(c));
    return () => {
      alive = false;
    };
  }, [parentId, outputs, innerResults]);

  if (!parentId || !parent) return null;
  const def = registry.get(parent.data.blockType);
  const text = blockText(parent.data.blockType);

  return (
    <div
      className="interior"
      role="dialog"
      aria-modal="true"
      aria-label={`Por dentro: ${text.title}`}
    >
      <header className="interior-head">
        <nav className="crumbs" aria-label="Dónde estás">
          <button className="btn btn-quiet" onClick={closeInterior}>
            Circuito principal
          </button>
          <span aria-hidden>›</span>
          <strong>
            {def?.icon} {text.title} por dentro
          </strong>
        </nav>
        <p>
          {text.interior ??
            'Así funciona por dentro, montado con piezas básicas que también tienes en la paleta. El bloque real hace el mismo cálculo de forma optimizada.'}{' '}
          Haz clic en cualquier cable para ver qué pasa por él; lo que cambies aquí no afecta al
          circuito principal.
        </p>
        <ComparisonBadge c={comparison} hasOutput={Object.keys(outputs).length > 0} />
        <button className="btn btn-primary" onClick={closeInterior}>
          Volver
        </button>
      </header>
      <ScopeContext.Provider value={interiorStore}>
        <div className="interior-body">
          <ReactFlowProvider>
            <ErrorBoundary label="el interior">
              <InteriorCanvas />
            </ErrorBoundary>
          </ReactFlowProvider>
          <ErrorBoundary label="el panel lateral">
            <Inspector />
          </ErrorBoundary>
        </div>
      </ScopeContext.Provider>
    </div>
  );
}

function ComparisonBadge({ c, hasOutput }: { c: Comparison; hasOutput: boolean }) {
  if (!hasOutput) {
    return (
      <p className="compare-badge">
        Este interior muestra el proceso; la escritura final de los bits no se representa.
      </p>
    );
  }
  if (!c) return <p className="compare-badge">Comparando con el bloque real…</p>;
  if (c.kind === 'bits') {
    const pct = (100 * c.equalBits) / Math.max(1, c.totalBits);
    return (
      <p className={`compare-badge${pct === 100 ? ' is-match' : ''}`}>
        {pct === 100
          ? 'Bits idénticos a los del bloque real'
          : `Coinciden el ${formatNumber(pct, 2)} % de los bits`}
      </p>
    );
  }
  const match = c.snr > 60;
  return (
    <p className={`compare-badge${match ? ' is-match' : ''}`}>
      {match ? 'Misma salida que el bloque real' : 'Salida parecida a la del bloque real'} (SNR
      entre ambas: {Number.isFinite(c.snr) ? `${formatNumber(c.snr, 0)} dB` : '∞'})
    </p>
  );
}

function InteriorCanvas() {
  const nodes = interiorStore((s) => s.nodes);
  const edges = interiorStore((s) => s.edges);
  const loadCount = interiorStore((s) => s.loadCount);
  const { fitView } = useReactFlow();
  const st = interiorStore.getState();

  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1 }));
    return () => cancelAnimationFrame(id);
  }, [loadCount, fitView]);

  return (
    <div className="canvas interior-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={st.onNodesChange}
        onEdgesChange={st.onEdgesChange}
        onConnect={st.onConnect}
        isValidConnection={(c: Connection | Edge) => interiorStore.getState().isValidConnection(c)}
        onNodeClick={(_, n) => st.select({ kind: 'node', id: n.id })}
        onEdgeClick={(_, e) => st.select({ kind: 'edge', id: e.id })}
        onPaneClick={() => st.select(null)}
        minZoom={0.2}
        maxZoom={1.75}
        deleteKeyCode={null}
      >
        <Background id="fine" variant={BackgroundVariant.Lines} gap={10} color="var(--grid-fine)" />
        <Background id="coarse" variant={BackgroundVariant.Lines} gap={50} color="var(--grid)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

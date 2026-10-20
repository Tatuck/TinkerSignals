import { Controls, ReactFlow, useReactFlow, type Connection, type Edge } from '@xyflow/react';
import { useCallback, useEffect, type DragEvent } from 'react';
import { BlockNode } from '../nodes/BlockNode';
import { useStore } from '../store';
import { CableEdge } from './CableEdge';
import { Timeline } from './Timeline';
import { LessonPanel } from '../lessons/LessonPanel';
import { openInterior } from '../interior/openInterior';
import { examples, instantiate } from '../examples';
import { lessons } from '../lessons/lessons';
import { useLesson } from '../lessons/lessonStore';

export const nodeTypes = { block: BlockNode };
export const edgeTypes = { cable: CableEdge };
export const DRAG_MIME = 'application/x-tinkersignals-block';

export function Canvas() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const isValid = useStore((s) => s.isValidConnection);
  const select = useStore((s) => s.select);
  const addBlock = useStore((s) => s.addBlock);
  const loadCount = useStore((s) => s.loadCount);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Al cargar un ejemplo o un circuito importado, encuádralo entero.
  useEffect(() => {
    if (!loadCount) return;
    const id = requestAnimationFrame(
      () => void fitView({ padding: 0.12, maxZoom: 1.2, duration: 300 }),
    );
    return () => cancelAnimationFrame(id);
  }, [loadCount, fitView]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const type = e.dataTransfer.getData(DRAG_MIME);
      if (!type) return;
      e.preventDefault();
      addBlock(type, screenToFlowPosition({ x: e.clientX - 120, y: e.clientY - 24 }));
    },
    [addBlock, screenToFlowPosition],
  );

  return (
    <div className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(c: Connection | Edge) => isValid(c)}
        onNodeClick={(_, n) => select({ kind: 'node', id: n.id })}
        onNodeDoubleClick={(_, n) => void openInterior(n.id)}
        onEdgeClick={(_, e) => select({ kind: 'edge', id: e.id })}
        onPaneClick={() => select(null)}
        defaultEdgeOptions={{ type: 'cable' }}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={1.75}
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
      <Timeline />
      <LessonPanel />
      {nodes.length === 0 && <EmptyCanvas />}
    </div>
  );
}

/** Lienzo vacío: qué hacer primero, en el sitio donde aparecerá el circuito. */
function EmptyCanvas() {
  const load = useStore((s) => s.load);
  const startLesson = useLesson((l) => l.start);
  return (
    <div className="canvas-empty">
      <h2>El lienzo está vacío</h2>
      <p>
        Arrastra un bloque desde la izquierda, empezando por una fuente de sonido, o abre un
        circuito ya montado.
      </p>
      <div className="canvas-empty-actions">
        <button className="btn" onClick={() => startLesson(lessons[0].id)}>
          Primera lección: {lessons[0].title}
        </button>
        <button
          className="btn"
          onClick={() => {
            const g = instantiate(examples[0]);
            load(g.nodes, g.edges);
          }}
        >
          Abrir «{examples[0].title}»
        </button>
      </div>
    </div>
  );
}

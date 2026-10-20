import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { useCallback, useEffect, type DragEvent } from 'react';
import { BlockNode } from '../nodes/BlockNode';
import { useStore } from '../store';
import { CableEdge } from './CableEdge';

const nodeTypes = { block: BlockNode };
const edgeTypes = { cable: CableEdge };
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
    const id = requestAnimationFrame(() => void fitView({ padding: 0.2, maxZoom: 1, duration: 300 }));
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
        onEdgeClick={(_, e) => select({ kind: 'edge', id: e.id })}
        onPaneClick={() => select(null)}
        defaultEdgeOptions={{ type: 'cable' }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.75}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
      >
        <Background id="fine" variant={BackgroundVariant.Lines} gap={10} color="var(--grid-fine)" />
        <Background id="coarse" variant={BackgroundVariant.Lines} gap={50} color="var(--grid)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

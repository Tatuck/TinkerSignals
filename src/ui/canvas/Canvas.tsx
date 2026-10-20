import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { useCallback, type DragEvent } from 'react';
import { BlockNode } from '../nodes/BlockNode';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor } from '../theme';
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
  const { screenToFlowPosition } = useReactFlow();

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
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const def = registry.get((n.data as { blockType: string }).blockType);
            return def ? categoryColor[def.category] : '#999';
          }}
          maskColor="rgba(238, 242, 246, 0.7)"
          style={{ width: 150, height: 96 }}
        />
      </ReactFlow>
    </div>
  );
}

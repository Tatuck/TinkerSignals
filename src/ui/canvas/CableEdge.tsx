import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import { formatMetric, formatRate } from '../lib/format';
import { registry } from '../registry';
import { useGraphStore, type CableEdge as CableEdgeType } from '../store';
import { portColor } from '../theme';

/**
 * Cable tipo "patch" de sintetizador modular: cuelga un poco por su peso.
 * El color y el trazo dicen qué viaja: azul continuo = audio, ámbar
 * discontinuo y en movimiento = bits. La etiqueta resume lo que pasa.
 */
export const CableEdge = memo(function CableEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<CableEdgeType>) {
  const useS = useGraphStore();
  const blockType = useS((s) => s.nodes.find((n) => n.id === source)?.data.blockType);
  const port = useS((s) => s.results?.nodes[source]?.outputs[sourceHandleId ?? '']);
  const type =
    (blockType && registry.get(blockType)?.outputs[sourceHandleId ?? '']?.type) || 'signal';

  const dx = Math.abs(targetX - sourceX);
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const sag = Math.min(70, dist * 0.18);
  const c1 = { x: sourceX + Math.max(40, dx * 0.4), y: sourceY + sag };
  const c2 = { x: targetX - Math.max(40, dx * 0.4), y: targetY + sag };
  const path = `M${sourceX},${sourceY} C${c1.x},${c1.y} ${c2.x},${c2.y} ${targetX},${targetY}`;
  // Punto medio de la Bézier (t = 0,5).
  const mx = 0.125 * sourceX + 0.375 * c1.x + 0.375 * c2.x + 0.125 * targetX;
  const my = 0.125 * sourceY + 0.375 * c1.y + 0.375 * c2.y + 0.125 * targetY;

  let label: string | null = null;
  if (port?.summary.kind === 'signal') label = formatRate(port.summary.sampleRate);
  if (port?.summary.kind === 'frames') {
    label = `${port.summary.count} × ${port.summary.size}`;
  }
  if (port?.summary.kind === 'packets') {
    const r = formatMetric(port.summary.networkBitrate, 'bps');
    label = `${r.value} ${r.unit} en red`;
  }
  if (port?.summary.kind === 'bitstream') {
    const r = formatMetric(port.summary.bitrate, 'bps');
    const u = port.summary.perUnit;
    label = u ? `${formatMetric(u.bits, '').value} bits/${u.name}` : `${r.value} ${r.unit}`;
  }
  if (port?.summary.kind === 'image') {
    label = `${port.summary.width}×${port.summary.height}${port.summary.domain === 'dct' ? ' DCT' : ''}`;
  }

  const color = portColor[type];
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`cable cable-${type}${selected ? ' is-selected' : ''}${port ? '' : ' is-idle'}`}
        style={{ '--cable': color } as CSSProperties}
        interactionWidth={18}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`cable-label${selected ? ' is-selected' : ''}`}
            style={
              {
                transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
                '--cable': color,
              } as CSSProperties
            }
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

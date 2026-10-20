import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import type { AudioParam } from '@/engine/types';
import { blockText, metricLabel, t } from '@/i18n';
import { formatMetric } from '../lib/format';
import { Envelope } from '../plots/Envelope';
import { Plot } from '../plots/Plot';
import { registry } from '../registry';
import { useStore, type BlockNode as BlockNodeType } from '../store';
import { categoryColor, portColor } from '../theme';
import { AssetWidget } from './AssetWidget';
import { OutputControls } from './OutputControls';

const PLOT_W = 216;
const PLOT_H = 60;

/**
 * Nodo genérico: sabe pintar cualquier bloque a partir de su definición
 * (puertos, parámetros) y de su resultado (métricas, gráficas, estado).
 * Un bloque nuevo no necesita tocar este fichero.
 */
export const BlockNode = memo(function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const def = registry.get(data.blockType);
  const result = useStore((s) => s.results?.nodes[id]);
  if (!def) return <div className="node node-unknown">{data.blockType}</div>;

  const text = blockText(def.id);
  const color = categoryColor[def.category];
  const inputs = Object.entries(def.inputs);
  const outputs = Object.entries(def.outputs);
  const rows = Math.max(inputs.length, outputs.length);
  const status = result?.status ?? 'waiting';
  const highlights = (result?.metrics ?? []).filter((m) => m.highlight).slice(0, 3);
  const firstPlot = result?.plots[0];
  const firstOut = outputs[0] && result?.outputs[outputs[0][0]];
  const audioParam = Object.entries(def.params).find(([, s]) => s.type === 'audio') as
    | [string, AudioParam]
    | undefined;

  return (
    <div
      className={`node status-${status}${selected ? ' is-selected' : ''}`}
      style={{ '--cat': color } as CSSProperties}
    >
      <header className="node-head">
        <span className="node-icon" aria-hidden>
          {def.icon}
        </span>
        <span className="node-title">{text.title}</span>
      </header>

      <div className="node-ports">
        {Array.from({ length: rows }, (_, i) => (
          <div className="port-row" key={i}>
            <span className="port port-in">
              {inputs[i] && (
                <>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={inputs[i][0]}
                    className={`handle handle-${inputs[i][1].type}`}
                    style={{ '--port': portColor[inputs[i][1].type] } as CSSProperties}
                  />
                  {text.ports?.[inputs[i][0]] ?? inputs[i][0]}
                  {inputs[i][1].optional && <em className="port-optional"> (opcional)</em>}
                </>
              )}
            </span>
            <span className="port port-out">
              {outputs[i] && (
                <>
                  {text.ports?.[outputs[i][0]] ?? outputs[i][0]}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={outputs[i][0]}
                    className={`handle handle-${outputs[i][1].type}`}
                    style={{ '--port': portColor[outputs[i][1].type] } as CSSProperties}
                  />
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="node-body">
        {status === 'error' && <p className="node-msg node-error">{result?.error}</p>}
        {status === 'waiting' && (
          <p className="node-msg">
            {result?.error ??
              (result?.missingInputs?.length
                ? t('node.connect', {
                    ports: result.missingInputs.map((p) => text.ports?.[p] ?? p).join(', '),
                  })
                : t('node.waiting'))}
          </p>
        )}

        {status === 'ok' && firstPlot && (
          <div className="node-plot">
            <Plot plot={firstPlot} color={color} width={PLOT_W} height={PLOT_H} />
          </div>
        )}
        {status === 'ok' && !firstPlot && firstOut?.summary.kind === 'signal' && (
          <div className="node-plot">
            <Envelope env={firstOut.summary.preview} width={PLOT_W} height={PLOT_H} color={color} />
          </div>
        )}

        {status === 'ok' && highlights.length > 0 && (
          <dl className="node-metrics">
            {highlights.map((m) => {
              const f = formatMetric(m.value, m.unit);
              return (
                <div key={m.key}>
                  <dt>{metricLabel(def.id, m.key)}</dt>
                  <dd>
                    {f.value}
                    <small>{f.unit}</small>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {status === 'ok' && result!.ownLatencyMs > 0 && (
          <p className="node-latency" title={t('latency.explain')}>
            <span aria-hidden>⏱</span> {t('node.latency')} {formatMetric(result!.ownLatencyMs, 'ms').value} ms
          </p>
        )}

        {audioParam && (
          <AssetWidget
            nodeId={id}
            paramKey={audioParam[0]}
            widget={audioParam[1].widget}
            assetId={data.params[audioParam[0]] as string | null}
          />
        )}
        {def.id === 'output' && <OutputControls nodeId={id} />}
      </div>
    </div>
  );
});

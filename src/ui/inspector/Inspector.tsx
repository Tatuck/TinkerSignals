import type { CSSProperties } from 'react';
import { blockText, metricLabel, t, tList } from '@/i18n';
import { formatMetric, formatNumber } from '../lib/format';
import { Plot } from '../plots/Plot';
import { ProbePanel } from '../probe/ProbePanel';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor } from '../theme';
import { ParamControl } from './ParamControl';

const PLOT_W = 292;

/** Panel derecho: explica y configura el bloque seleccionado, o sondea el cable seleccionado. */
export function Inspector() {
  const selection = useStore((s) => s.selection);
  return (
    <aside className="inspector" aria-live="polite">
      {selection?.kind === 'node' ? (
        <NodeInspector id={selection.id} />
      ) : selection?.kind === 'edge' ? (
        <ProbePanel edgeId={selection.id} />
      ) : (
        <Welcome />
      )}
    </aside>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <h2>{t('inspector.emptyTitle')}</h2>
      <p>{t('inspector.emptyBody')}</p>
      <ol>
        {tList('inspector.emptySteps').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function NodeInspector({ id }: { id: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === id));
  const result = useStore((s) => s.results?.nodes[id]);
  const setParam = useStore((s) => s.setParam);
  const removeNode = useStore((s) => s.removeNode);
  const duplicateNode = useStore((s) => s.duplicateNode);
  const def = node && registry.get(node.data.blockType);
  if (!node || !def) return <Welcome />;

  const text = blockText(def.id);
  const color = categoryColor[def.category];
  const params = Object.entries(def.params).filter(
    ([, s]) =>
      s.type !== 'audio' &&
      (!s.visibleIf ||
        s.visibleIf.equals.includes(
          (node.data.params[s.visibleIf.param] ?? def.params[s.visibleIf.param]?.default) as
            string | boolean,
        )),
  );

  return (
    <div className="node-inspector" style={{ '--cat': color } as CSSProperties}>
      <header className="insp-head">
        <span className="insp-icon" aria-hidden>
          {def.icon}
        </span>
        <div>
          <h2>{text.title}</h2>
          <p className="insp-cat">{t(`categories.${def.category}`)}</p>
        </div>
      </header>

      <section>
        <p className="insp-summary">{text.summary}</p>
        {text.details && (
          <details className="insp-details">
            <summary>{t('inspector.howItWorks')}</summary>
            <p>{text.details}</p>
          </details>
        )}
      </section>

      {params.length > 0 && (
        <section>
          <h3>{t('inspector.params')}</h3>
          {params.map(([name, spec]) => (
            <ParamControl
              key={name}
              blockId={def.id}
              name={name}
              spec={spec}
              value={node.data.params[name] ?? spec.default}
              onChange={(v) => setParam(id, name, v)}
            />
          ))}
        </section>
      )}

      {result?.status === 'ok' && result.metrics.length > 0 && (
        <section>
          <h3>{t('inspector.results')}</h3>
          <dl className="insp-metrics">
            {result.metrics.map((m) => {
              const f = formatMetric(m.value, m.unit);
              return (
                <div key={m.key} className={m.highlight ? 'is-highlight' : ''}>
                  <dt>{metricLabel(def.id, m.key)}</dt>
                  <dd>
                    {f.value} <small>{f.unit}</small>
                  </dd>
                </div>
              );
            })}
            {result.ownLatencyMs > 0 && (
              <div title={t('latency.explain')}>
                <dt>{t('metrics.latency')}</dt>
                <dd>
                  {formatMetric(result.ownLatencyMs, 'ms').value} <small>ms</small>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {result?.status === 'error' && <p className="node-msg node-error">{result.error}</p>}

      {result?.status === 'ok' && result.plots.length > 0 && (
        <section>
          <h3>{t('inspector.plots')}</h3>
          {result.plots.map((p, i) => (
            <div key={i} className="insp-plot">
              <h4>{text.plots?.[p.title] ?? p.title}</h4>
              <Plot
                plot={p}
                color={color}
                width={PLOT_W}
                height={p.kind === 'bars' ? 90 : 120}
                detailed
              />
            </div>
          ))}
        </section>
      )}

      {text.tryThis && (
        <section className="try-this">
          <h3>{t('inspector.tryThis')}</h3>
          <p>{text.tryThis}</p>
        </section>
      )}

      {text.ref && (
        <p className="insp-ref">
          {t('inspector.reference')}: {text.ref}
        </p>
      )}

      <footer className="insp-actions">
        <button className="btn" onClick={() => duplicateNode(id)}>
          {t('inspector.duplicate')}
        </button>
        <button className="btn btn-danger" onClick={() => removeNode(id)}>
          {t('inspector.delete')}
        </button>
      </footer>
      {result && (
        <p className="insp-timing">
          {result.cached
            ? t('inspector.fromCache')
            : t('inspector.computeTime', { ms: formatNumber(result.computeMs, 1) })}
        </p>
      )}
    </div>
  );
}

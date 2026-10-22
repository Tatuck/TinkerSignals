import type { CSSProperties } from 'react';
import { blockText, metricLabel, t, tList } from '@/i18n';
import { formatMetric, formatNumber } from '../lib/format';
import { Plot } from '../plots/Plot';
import { ProbePanel } from '../probe/ProbePanel';
import { registry } from '../registry';
import { useGraphStore, useStore } from '../store';
import { conceptFor } from '@/theory/es';
import { categoryColor, outputSeriesColor } from '../theme';
import { BlockGlyph } from '../BlockGlyph';
import { ParamControl } from './ParamControl';
import { useLessonTarget } from '../lessons/LessonPanel';
import { lessons } from '../lessons/lessons';
import { useLesson } from '../lessons/lessonStore';
import { openInterior } from '../interior/openInterior';
import { useInstant } from '../lib/useInstant';

const PLOT_W = 292;

/** Panel derecho: explica y configura el bloque seleccionado, o sondea el cable seleccionado. */
export function Inspector() {
  const useS = useGraphStore();
  const selection = useS((s) => s.selection);
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

const REPO = 'https://github.com/Tatuck/TinkerSignals';

function Welcome() {
  const scope = useGraphStore()((s) => s.scope);
  const startLesson = useLesson((l) => l.start);
  const current = useLesson((l) => l.lesson?.id);
  return (
    <div className="welcome">
      <h2>{t('inspector.emptyTitle')}</h2>
      <p>{t('inspector.emptyBody')}</p>
      <ol className="welcome-steps">
        {tList('inspector.emptySteps').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {scope === 'main' && (
        <section>
          <h3>Lecciones guiadas</h3>
          <p className="welcome-lead">Pasos cortos que te dicen qué tocar y en qué fijarte.</p>
          <ol className="lesson-list">
            {lessons.map((l) => (
              <li key={l.id}>
                <button
                  className={l.id === current ? 'is-current' : ''}
                  onClick={() => startLesson(l.id)}
                >
                  <strong>{l.title}</strong>
                  <small>
                    {l.steps.length} pasos · {l.minutes} min
                  </small>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <footer className="welcome-foot">
        <a href={REPO} target="_blank" rel="noreferrer">
          Código en GitHub
        </a>
        <span aria-hidden>·</span>
        <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
          Licencia MIT
        </a>
        <span aria-hidden>·</span>
        <a href={`${REPO}/blob/main/public/sounds/CREDITS.md`} target="_blank" rel="noreferrer">
          Créditos de los sonidos
        </a>
      </footer>
    </div>
  );
}

function NodeInspector({ id }: { id: string }) {
  const useS = useGraphStore();
  const node = useS((s) => s.nodes.find((n) => n.id === id));
  const result = useS((s) => s.results?.nodes[id]);
  const setParam = useS((s) => s.setParam);
  const removeNode = useS((s) => s.removeNode);
  const duplicateNode = useS((s) => s.duplicateNode);
  const target = useLessonTarget();
  const scope = useS((s) => s.scope);
  const instant = useInstant(id);
  const def = node && registry.get(node.data.blockType);
  if (!node || !def) return <Welcome />;

  const text = blockText(def.id);
  const cat = categoryColor[def.category];
  const color = outputSeriesColor;
  const params = Object.entries(def.params).filter(
    ([, s]) =>
      s.type !== 'audio' &&
      s.type !== 'external' &&
      !s.hidden &&
      (!s.visibleIf ||
        s.visibleIf.equals.includes(
          (node.data.params[s.visibleIf.param] ?? def.params[s.visibleIf.param]?.default) as
            string | boolean,
        )),
  );

  return (
    <div className="node-inspector" style={{ '--cat': cat } as CSSProperties}>
      <header className="insp-head">
        <BlockGlyph category={def.category} size={40} />
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
              highlighted={target.node === id && target.param === name}
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

      {instant?.data && instant.data.detail.length > 0 && (
        <section className="insp-instant">
          <h3>{t('timeline.at', { t: formatNumber(instant.time, 3) })}</h3>
          {instant.data.detail.map((p, i) => (
            <div key={i} className="insp-plot">
              <h4>
                {text.plots?.[p.title] ??
                  (t(`plots.${p.title}`) !== `plots.${p.title}` ? t(`plots.${p.title}`) : p.title)}
              </h4>
              <Plot
                plot={p}
                color={color}
                width={PLOT_W}
                height={p.kind === 'bars' ? 90 : p.kind === 'line' && p.xTicks ? 150 : 120}
                detailed
              />
            </div>
          ))}
        </section>
      )}

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
                height={p.kind === 'bars' ? 90 : p.kind === 'line' && p.xTicks ? 150 : 120}
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

      {text.concepts && text.concepts.length > 0 && (
        <section>
          <h3>{t('inspector.concepts')}</h3>
          <ul className="concepts">
            {text.concepts.map((c) => {
              const concept = conceptFor(c);
              return (
                <li key={c}>
                  {concept ? (
                    <button
                      className="concept-link"
                      onClick={() => useStore.setState({ theory: concept.id })}
                      title={`Abrir la ficha «${concept.title}»`}
                    >
                      {c}
                    </button>
                  ) : (
                    c
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="insp-actions">
        {def.interior && scope === 'main' && (
          <button className="btn btn-primary" onClick={() => void openInterior(id)}>
            Ver por dentro
          </button>
        )}
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

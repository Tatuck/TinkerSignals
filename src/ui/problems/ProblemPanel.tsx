import { useEffect } from 'react';
import { related } from '@/content';
import { levels, topicById } from '@/content/topics';
import type { Plot as PlotData } from '@/engine/types';
import { blockText } from '@/i18n';
import { catalog, catalogItem } from '../catalog';
import { explore, openItem } from '../explore/open';
import { Plot, TableGrid } from '../plots/Plot';
import { RichInline, RichText } from '../text/RichText';
import { useProblem } from './problemStore';

const levelTitle = (id: string) => levels.find((l) => l.id === id)?.title ?? id;

/** Formatea un valor esperado para enseñarlo en la solución. */
function show(v: number | string | undefined): string {
  if (v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return v.toLocaleString('es-ES');
  return Number(v.toPrecision(6)).toLocaleString('es-ES', { maximumFractionDigits: 4 });
}

/**
 * Un problema como los de examen, con números nuevos cada vez. Lo resuelve
 * el propio motor con los bloques reales: la corrección y las tablas de la
 * solución salen de ahí.
 */
export function ProblemPanel() {
  const s = useProblem();
  const { problem, visible } = s;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useProblem.getState().close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!problem || !visible) return null;
  const data = s.data;
  const hints = problem.hints?.(data) ?? [];
  const waiting = !!problem.circuit && !s.result;
  const checked = Object.keys(s.marks).length > 0;
  const allRight = checked && Object.values(s.marks).every(Boolean);
  const item = catalogItem('problema', problem.id);
  const next = allRight && item ? related(item, catalog, 3) : [];
  const tables: { key: string; title: string; plot: PlotData }[] = s.revealed
    ? [
        ...(problem.solutionTables ?? []).flatMap(([node, title]) => {
          const p = s.result?.nodes[node]?.plots.find(
            (x) => x.kind === 'table' && x.title === title,
          );
          const type = problem.circuit?.(data).nodes.find((n) => n.id === node)?.type ?? '';
          const name = blockText(type).plots?.[title] ?? title;
          return p ? [{ key: `${node}:${title}`, title: name, plot: p }] : [];
        }),
        ...(problem.tables?.(data, s.ctx) ?? []).map((t, i) => ({
          key: `t${i}`,
          title: t.title,
          plot: { kind: 'table' as const, ...t },
        })),
      ]
    : [];

  return (
    <div className="theory-backdrop" onMouseDown={(e) => e.target === e.currentTarget && s.close()}>
      <div className="problem" role="dialog" aria-modal="true" aria-label={problem.title}>
        <header className="problem-head">
          <div>
            <p className="problem-kicker">
              Problema · {topicById(problem.topic)?.title} · {levelTitle(problem.level)}
            </p>
            <h2>{problem.title}</h2>
          </div>
          <div className="problem-head-actions">
            <button
              className="btn btn-quiet"
              onClick={explore.back}
              title="El problema se queda a mano para volver"
            >
              ← Explorar
            </button>
            <button className="btn" onClick={s.another} title="Mismo problema, otros datos">
              Otros números
            </button>
            <button className="btn btn-quiet" onClick={s.close} aria-label="Cerrar">
              Cerrar
            </button>
          </div>
        </header>

        <div className="problem-statement">
          <RichText text={problem.statement(data)} />
        </div>

        <form
          className="problem-answers"
          onSubmit={(e) => {
            e.preventDefault();
            s.check();
          }}
        >
          {problem.answers.map((a) => {
            const mark = s.marks[a.key];
            return (
              <label
                key={a.key}
                className={`answer${mark === true ? ' is-right' : mark === false ? ' is-wrong' : ''}`}
              >
                <span className="answer-label">
                  <RichInline text={a.label} />
                </span>
                <span className="answer-field">
                  <input
                    type="text"
                    inputMode={a.kind === 'text' ? 'text' : 'decimal'}
                    autoComplete="off"
                    spellCheck={false}
                    value={s.inputs[a.key] ?? ''}
                    onChange={(e) => s.setInput(a.key, e.target.value)}
                    aria-invalid={mark === false}
                  />
                  {a.unit && <span className="answer-unit">{a.unit}</span>}
                  <span className="answer-mark" aria-live="polite">
                    {mark === true ? 'Correcto' : mark === false ? 'Revisa' : ''}
                  </span>
                </span>
                {s.revealed && (
                  <span className="answer-solution">
                    Solución: <strong>{show(s.expected[a.key])}</strong>
                    {a.unit ? ` ${a.unit}` : ''}
                  </span>
                )}
              </label>
            );
          })}
          <div className="problem-actions">
            <button type="submit" className="btn btn-primary" disabled={waiting}>
              {waiting ? 'Preparando…' : 'Corregir'}
            </button>
            {hints.length > 0 && (
              <button
                type="button"
                className="btn"
                disabled={s.hints >= hints.length}
                onClick={s.hint}
              >
                Pista {Math.min(s.hints + 1, hints.length)}/{hints.length}
              </button>
            )}
            <button type="button" className="btn" disabled={waiting} onClick={s.reveal}>
              Ver solución
            </button>
            {problem.circuit && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={s.toLab}
                title="Monta en el lienzo el circuito que lo resuelve"
              >
                Abrir en el laboratorio
              </button>
            )}
          </div>
        </form>

        {allRight && (
          <p className="problem-done">
            ¡Todo correcto! Prueba con <button onClick={s.another}>otros números</button>
            {next.length > 0 && (
              <>
                {' '}
                o sigue con{' '}
                {next.map((x, i) => (
                  <span key={x.id}>
                    {i > 0 && ', '}
                    <button onClick={() => openItem(x)}>{x.title}</button>
                  </span>
                ))}
              </>
            )}
            .
          </p>
        )}

        {s.hints > 0 && (
          <ol className="problem-hints">
            {hints.slice(0, s.hints).map((h, i) => (
              <li key={i}>
                <RichText text={h} />
              </li>
            ))}
          </ol>
        )}

        {s.revealed && (
          <section className="problem-solution">
            <h3>Solución paso a paso</h3>
            {problem.explain && <RichText text={problem.explain(data, s.ctx)} />}
            {tables.map(({ key, title, plot }) =>
              plot.kind === 'table' ? (
                <div key={key} className="problem-table">
                  <h4>
                    <RichInline text={title} />
                  </h4>
                  {plot.stepwise ? (
                    <Plot plot={plot} color="" width={600} height={200} detailed />
                  ) : (
                    <TableGrid plot={plot} />
                  )}
                </div>
              ) : null,
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/** Aviso flotante cuando el problema está en el laboratorio: volver al enunciado. */
export function ProblemChip() {
  const problem = useProblem((s) => s.problem);
  const visible = useProblem((s) => s.visible);
  if (!problem || visible) return null;
  return (
    <div className="problem-chip" role="status">
      <span>
        Problema: <strong>{problem.title}</strong>
      </span>
      <button className="btn btn-small btn-primary" onClick={useProblem.getState().show}>
        Volver al enunciado
      </button>
      <button
        className="btn btn-small btn-quiet"
        onClick={useProblem.getState().close}
        aria-label="Cerrar el problema"
      >
        Cerrar
      </button>
    </div>
  );
}

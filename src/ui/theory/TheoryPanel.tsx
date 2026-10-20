import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { blockText } from '@/i18n';
import { conceptById, concepts, type Concept } from '@/theory/es';
import { registry } from '../registry';
import { useStore } from '../store';
import { BlockGlyph } from '../BlockGlyph';

/** Fórmula renderizada con KaTeX (el texto es nuestro, no del usuario). */
function Formula({ tex }: { tex: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: true, throwOnError: false }),
    [tex],
  );
  return <div className="formula" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Fichas de teoría: índice buscable a la izquierda, ficha a la derecha. */
export function TheoryPanel() {
  const openId = useStore((s) => s.theory);
  const close = () => useStore.setState({ theory: null });
  const [query, setQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [openId]);

  if (openId === null) return null;
  const concept = conceptById(openId) ?? concepts[0];
  const q = query.trim().toLowerCase();
  const list = concepts.filter(
    (c) => !q || `${c.title} ${c.aliases.join(' ')} ${c.body.join(' ')}`.toLowerCase().includes(q),
  );

  return (
    <div className="theory-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="theory" role="dialog" aria-modal="true" aria-label="Teoría">
        <aside className="theory-index">
          <h2>Teoría</h2>
          <input
            className="search"
            type="search"
            placeholder="Buscar concepto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul>
            {list.map((c) => (
              <li key={c.id}>
                <button
                  className={c.id === concept.id ? 'is-on' : ''}
                  onClick={() => useStore.setState({ theory: c.id })}
                >
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <article className="theory-body" ref={bodyRef}>
          <header>
            <h2>{concept.title}</h2>
            <button className="btn btn-quiet" onClick={close} aria-label="Cerrar">
              Cerrar
            </button>
          </header>
          {concept.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {concept.formulas.length > 0 && (
            <section>
              <h3>Fórmulas</h3>
              {concept.formulas.map((f) => (
                <figure key={f.tex} className="formula-card">
                  <Formula tex={f.tex} />
                  <figcaption>{f.caption}</figcaption>
                </figure>
              ))}
            </section>
          )}
          <TryIt concept={concept} onDone={close} />
          {concept.related.length > 0 && (
            <section>
              <h3>Relacionado</h3>
              <ul className="concepts">
                {concept.related.map((id) => (
                  <li key={id}>
                    <button
                      className="concept-link"
                      onClick={() => useStore.setState({ theory: id })}
                    >
                      {conceptById(id)?.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}

/** Bloques donde verlo: un clic lo añade al lienzo. */
function TryIt({ concept, onDone }: { concept: Concept; onDone(): void }) {
  const add = (type: string) => {
    const { nodes, addBlock } = useStore.getState();
    const right = nodes.reduce((m, n) => Math.max(m, n.position.x), -320);
    const y = nodes.length ? nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length : 0;
    addBlock(type, { x: right + 320, y });
    useStore.getState().notify(`«${blockText(type).title}» añadido al lienzo.`);
    onDone();
  };
  return (
    <section>
      <h3>Pruébalo</h3>
      <ul className="try-blocks">
        {concept.blocks.map((b) => {
          const def = registry.get(b);
          if (!def) return null;
          return (
            <li key={b}>
              <button className="btn" onClick={() => add(b)}>
                <BlockGlyph category={def.category} size={22} /> {blockText(b).title}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

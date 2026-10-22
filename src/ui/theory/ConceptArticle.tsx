import { blockText } from '@/i18n';
import { conceptById, conceptFor, type Concept } from '@/theory/es';
import { setFocus } from '../focus/focus';
import { registry } from '../registry';
import { useStore } from '../store';
import { BlockGlyph } from '../BlockGlyph';
import { Formula, RichText, useReveal } from '../text/RichText';

/**
 * Una ficha de teoría completa: explicación, fórmulas, dónde está en tu
 * circuito, bloques para probarla y fichas relacionadas. Se lee dentro de
 * Explorar; `onDone` cierra el catálogo cuando la ficha lleva al lienzo.
 */
export function ConceptArticle({
  concept,
  onNavigate,
  onDone,
}: {
  concept: Concept;
  onNavigate(id: string): void;
  onDone(): void;
}) {
  return (
    <>
      {concept.body.map((p, i) => (
        <RichText key={i} text={p} />
      ))}
      <InYourCircuit concept={concept} onDone={onDone} />
      {concept.formulas.length > 0 && (
        <section>
          <h3>Fórmulas</h3>
          {concept.formulas.map((f) => (
            <figure key={f.tex} className="formula-card">
              <Formula tex={f.tex} block />
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
        </section>
      )}
      <TryIt concept={concept} onDone={onDone} />
      {concept.related.length > 0 && (
        <section>
          <h3>Fichas relacionadas</h3>
          <ul className="concepts">
            {concept.related.map((id) => (
              <li key={id}>
                <button className="concept-link" onClick={() => onNavigate(id)}>
                  {conceptById(id)?.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
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

/** Bloques de este concepto que ya están en el circuito: se pueden señalar en el lienzo. */
function InYourCircuit({ concept, onDone }: { concept: Concept; onDone(): void }) {
  const nodes = useStore((s) => s.nodes);
  const reveal = useReveal();
  const here = nodes.filter((n) => {
    const type = n.data.blockType;
    return (
      concept.blocks.includes(type) ||
      (blockText(type).concepts ?? []).some((c) => conceptFor(c)?.id === concept.id)
    );
  });
  if (!here.length) return null;
  const show = () => {
    const focus = { nodes: here.map((n) => n.id) };
    setFocus('theory', focus);
    onDone();
    reveal(focus);
  };
  return (
    <aside className="in-circuit">
      <p>
        <strong>En tu circuito:</strong>{' '}
        {[...new Set(here.map((n) => blockText(n.data.blockType).title))].join(', ')}.
      </p>
      <button className="btn btn-small" onClick={show}>
        Señalarlos en el lienzo
      </button>
    </aside>
  );
}

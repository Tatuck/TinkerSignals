import { conceptById } from '@/theory/es';
import { Formula } from '../text/RichText';
import { useStore } from '../store';

/** Una ficha de teoría en pequeño, para incrustarla en una lección o un problema. */
export function ConceptCard({ id, open }: { id: string; open?: boolean }) {
  const c = conceptById(id);
  if (!c) return null;
  return (
    <details className="concept-card" open={open}>
      <summary>
        <span className="concept-card-kicker">Teoría</span> {c.title}
      </summary>
      {c.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {c.formulas.map((f) => (
        <figure key={f.tex} className="formula-card">
          <Formula tex={f.tex} block />
          <figcaption>{f.caption}</figcaption>
        </figure>
      ))}
      <button
        type="button"
        className="btn btn-quiet btn-small"
        onClick={() => useStore.setState({ theory: c.id })}
      >
        Abrir la ficha completa
      </button>
    </details>
  );
}

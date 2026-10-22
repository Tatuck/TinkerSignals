import { useLesson } from '../lessons/lessonStore';
import { useProblem } from '../problems/problemStore';
import { useStore } from '../store';
import { explore, useExplore } from './open';

/**
 * Aviso flotante con el ejemplo abierto desde Explorar, para volver al
 * catálogo. Desaparece si el circuito deja de ser ese ejemplo.
 */
export function ExploreChip() {
  const example = useExplore((x) => x.example);
  const open = useStore((x) => x.explore || x.theory !== null);
  const nodes = useStore((x) => x.nodes);
  const problem = useProblem((x) => x.problem);
  const lesson = useLesson((x) => x.lesson);
  if (!example || open || problem || lesson) return null;
  if (!example.nodes.some((id) => nodes.some((n) => n.id === id))) return null;
  return (
    <div className="problem-chip explore-chip" role="status">
      <span title={example.title}>
        Ejemplo: <strong>{example.title}</strong>
      </span>
      <button className="btn btn-small" onClick={explore.back}>
        ← Volver a Explorar
      </button>
      <button
        className="btn btn-small btn-quiet"
        onClick={() => useExplore.setState({ example: null })}
        aria-label="Quitar este aviso"
      >
        ×
      </button>
    </div>
  );
}

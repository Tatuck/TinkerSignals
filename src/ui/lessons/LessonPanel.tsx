import { useStore } from '../store';
import { lessonContext, useLesson } from './lessonStore';

/** Tarjeta flotante con el paso actual de la lección. */
export function LessonPanel() {
  const { lesson, step, go, exit } = useLesson();
  // Se vuelve a pintar con cada cambio del circuito para reevaluar el paso.
  useStore((s) => s.nodes);
  useStore((s) => s.results);
  if (!lesson) return null;
  const s = lesson.steps[step];
  const done = !s.check || s.check(lessonContext());
  const last = step === lesson.steps.length - 1;

  return (
    <section className="lesson" aria-live="polite" aria-label={`Lección: ${lesson.title}`}>
      <header>
        <span className="lesson-title">{lesson.title}</span>
        <span className="lesson-progress" aria-label={`Paso ${step + 1} de ${lesson.steps.length}`}>
          {lesson.steps.map((_, i) => (
            <i key={i} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} />
          ))}
        </span>
      </header>
      <p>{s.text}</p>
      {s.task && (
        <p className={`lesson-task${done ? ' is-done' : ''}`}>
          <span aria-hidden>{done ? '✓' : '○'}</span> {s.task}
        </p>
      )}
      <footer>
        <button className="btn btn-quiet" onClick={exit}>
          Salir
        </button>
        <span className="spacer" />
        {step > 0 && (
          <button className="btn" onClick={() => go(step - 1)}>
            Anterior
          </button>
        )}
        <button className="btn btn-primary" disabled={!done} onClick={() => (last ? exit() : go(step + 1))}>
          {last ? 'Terminar' : 'Siguiente'}
        </button>
      </footer>
    </section>
  );
}

const NO_TARGET: { node?: string; param?: string } = {};

/** ¿Qué bloque y parámetro hay que resaltar ahora? (Referencia estable: no provoca renders de más.) */
export function useLessonTarget(): { node?: string; param?: string } {
  return useLesson((l) => (l.lesson ? l.lesson.steps[l.step] : NO_TARGET));
}

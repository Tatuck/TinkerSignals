import { related } from '@/content';
import { catalog, catalogItem } from '../catalog';
import { explore, openItem } from '../explore/open';
import { ConceptCard } from '../theory/ConceptCard';
import { RichInline, RichText } from '../text/RichText';
import { useStore } from '../store';
import { lessonContext, useLesson } from './lessonStore';

const KIND_LABEL = {
  leccion: 'Lección',
  ejemplo: 'Ejemplo',
  problema: 'Problema',
  teoria: 'Teoría',
};

/** Tarjeta flotante con el paso actual de la lección. */
export function LessonPanel() {
  const { lesson, step, answers, finished, go, answer, finish, exit } = useLesson();
  // Se vuelve a pintar con cada cambio del circuito para reevaluar el paso.
  useStore((s) => s.nodes);
  useStore((s) => s.edges);
  useStore((s) => s.results);
  if (!lesson) return null;
  if (finished) return <Finished />;
  const s = lesson.steps[step];
  const chosen = answers[step];
  const predicted = !s.predict || chosen !== undefined;
  const done = predicted && (!s.check || s.check(lessonContext()));
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
      <div className="lesson-body">
        <RichText text={s.text} />
        {s.theory && <ConceptCard key={`${lesson.id}:${step}`} id={s.theory} />}

        {s.predict && (
          <div className="predict" role="group" aria-label="Predicción">
            <p className="predict-q">
              <span className="predict-kicker">¿Qué crees que pasará?</span>{' '}
              <RichInline text={s.predict.question} />
            </p>
            <div className="predict-options">
              {s.predict.options.map((o, i) => {
                const state =
                  chosen === undefined
                    ? ''
                    : i === s.predict!.answer
                      ? ' is-right'
                      : i === chosen
                        ? ' is-wrong'
                        : ' is-dim';
                return (
                  <button
                    key={i}
                    type="button"
                    className={`predict-option${state}`}
                    disabled={chosen !== undefined}
                    onClick={() => answer(step, i)}
                  >
                    <RichInline text={o} />
                  </button>
                );
              })}
            </div>
            {chosen !== undefined && (
              <div className={`predict-explain${chosen === s.predict.answer ? ' is-right' : ''}`}>
                <strong>
                  {chosen === s.predict.answer ? '¡Bien visto! ' : 'No exactamente. '}
                </strong>
                <RichText text={s.predict.explain} />
              </div>
            )}
          </div>
        )}

        {s.task && predicted && (
          <p className={`lesson-task${done ? ' is-done' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="lesson-check">
              <circle
                cx="7"
                cy="7"
                r="6"
                fill={done ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {done && (
                <path
                  d="M4.2 7.2 6.2 9.1 9.8 5.2"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>{' '}
            {s.task}
          </p>
        )}
      </div>
      <footer>
        <button className="btn btn-quiet" onClick={exit}>
          Salir
        </button>
        <button className="btn btn-quiet" onClick={explore.back} title="La lección sigue aquí">
          ← Explorar
        </button>
        <span className="spacer" />
        {step > 0 && (
          <button className="btn" onClick={() => go(step - 1)}>
            Anterior
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={!done}
          title={
            !predicted
              ? 'Responde primero a la pregunta'
              : !done
                ? 'Haz primero la tarea'
                : undefined
          }
          onClick={() => (last ? finish() : go(step + 1))}
        >
          {last ? 'Terminar' : 'Siguiente'}
        </button>
      </footer>
    </section>
  );
}

/** Al terminar: enhorabuena y qué hacer después (del mismo tema o relacionado). */
function Finished() {
  const { lesson, exit, go } = useLesson();
  const item = lesson && catalogItem('leccion', lesson.id);
  const next = item ? related(item, catalog, 3) : [];
  return (
    <section className="lesson" aria-live="polite" aria-label="Lección terminada">
      <header>
        <span className="lesson-title">{lesson?.title}</span>
      </header>
      <div className="lesson-body">
        <p>
          <strong>Lección terminada.</strong> Puedes seguir tocando el circuito: es tuyo.
        </p>
        {next.length > 0 && (
          <>
            <p className="lesson-next-title">Para seguir</p>
            <ul className="lesson-next">
              {next.map((x) => (
                <li key={`${x.kind}:${x.id}`}>
                  <button type="button" onClick={() => openItem(x)}>
                    <small>{KIND_LABEL[x.kind]}</small>
                    {x.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer>
        <button className="btn btn-quiet" onClick={() => lesson && go(lesson.steps.length - 1)}>
          Volver al último paso
        </button>
        <span className="spacer" />
        <button className="btn" onClick={explore.back}>
          ← Explorar
        </button>
        <button className="btn btn-primary" onClick={exit}>
          Cerrar
        </button>
      </footer>
    </section>
  );
}

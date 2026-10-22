import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CatalogItem, ItemKind } from '@/content';
import { audiences, levels, topicById, topicOfConcept, topics } from '@/content/topics';
import type { Audience, Level, TopicId } from '@/content/types';
import { conceptById } from '@/theory/es';
import { catalog, itemKey } from '../catalog';
import { useProgress } from '../lib/progress';
import { useStore } from '../store';
import { ConceptArticle } from '../theory/ConceptArticle';
import { explore, openItem, useExplore, type ExploreKind } from './open';

const KINDS: { id: ExploreKind; title: string }[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'teoria', title: 'Teoría' },
  { id: 'leccion', title: 'Lecciones' },
  { id: 'ejemplo', title: 'Ejemplos' },
  { id: 'problema', title: 'Problemas' },
];
const KIND_LABEL: Record<ItemKind, string> = {
  teoria: 'Teoría',
  leccion: 'Lección',
  ejemplo: 'Ejemplo',
  problema: 'Problema',
};
const LEVEL_LABEL = Object.fromEntries(levels.map((l) => [l.id, l.title])) as Record<Level, string>;

type ListFilters = { kind: ExploreKind; level: Level | 'todos'; audience: Audience | 'todos' };

/**
 * Catálogo de todo el contenido, por temas y en orden de estudio. Cada
 * tema propone una ruta: teoría → lección → ejemplos → problemas. Las fichas
 * de teoría se leen aquí mismo, sin salir del catálogo.
 */
export function ExplorePanel() {
  const open = useStore((s) => s.explore);
  const theory = useStore((s) => s.theory);
  if (!open && theory === null) return null;
  return <Explore />;
}

function Explore() {
  const { kind, topic, level, audience, query, setFilters } = useExplore();
  const theory = useStore((s) => s.theory);
  const concept = theory !== null ? conceptById(theory) : undefined;
  const bodyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && explore.close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al volver a la lista se recupera la posición en la que se dejó; una ficha empieza arriba.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = concept ? 0 : useExplore.getState().scroll;
  }, [concept]);

  /** Guarda la posición de la lista antes de dejarla. */
  const remember = () => {
    if (!concept) useExplore.setState({ scroll: bodyRef.current?.scrollTop ?? 0 });
  };
  const pick = (x: CatalogItem) => {
    remember();
    openItem(x);
  };
  const toList = () => useStore.setState({ explore: true, theory: null });
  const filter = (f: Parameters<typeof setFilters>[0]) => {
    setFilters(f);
    toList();
  };
  const conceptTopic = concept ? topicOfConcept(concept.id) : undefined;

  return (
    <div
      className="theory-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && explore.close()}
    >
      <div className="theory explore" role="dialog" aria-modal="true" aria-label="Explorar">
        <aside className="theory-index">
          <h2>Explorar</h2>
          <input
            className="search"
            type="search"
            placeholder="Buscar: huffman, pitch, JPEG…"
            value={query}
            onChange={(e) => filter({ query: e.target.value })}
            autoFocus={!concept}
          />
          <TopicList
            current={concept ? conceptTopic : topic}
            onPick={(t) => filter({ topic: t })}
          />
        </aside>

        <article className="theory-body explore-body" ref={bodyRef}>
          {concept ? (
            <>
              <header>
                <button className="btn btn-quiet" onClick={toList}>
                  ← Volver a Explorar
                </button>
                <button className="btn btn-quiet" onClick={explore.close} aria-label="Cerrar">
                  Cerrar
                </button>
              </header>
              <p className="explore-kicker">
                Teoría{conceptTopic ? ` · ${topicById(conceptTopic)?.title}` : ''}
              </p>
              <h2>{concept.title}</h2>
              <ConceptArticle
                concept={concept}
                onNavigate={(id) => useStore.setState({ theory: id })}
                onDone={explore.close}
              />
              <Practice conceptId={concept.id} onPick={pick} />
            </>
          ) : (
            <Listing
              filters={{ kind, level, audience }}
              topic={topic}
              query={query}
              onFilter={filter}
              onPick={pick}
            />
          )}
        </article>
      </div>
    </div>
  );
}

/** Índice de temas con cuánto se ha visto u hecho de cada uno. */
function TopicList({
  current,
  onPick,
}: {
  current: TopicId | 'todos' | undefined;
  onPick(t: TopicId | 'todos'): void;
}) {
  const progressOf = useTopicProgress();
  return (
    <ul>
      <li>
        <button className={current === 'todos' ? 'is-on' : ''} onClick={() => onPick('todos')}>
          Todos los temas
        </button>
      </li>
      {topics.map((t, i) => {
        const p = progressOf(t.id);
        return (
          <li key={t.id}>
            <button className={current === t.id ? 'is-on' : ''} onClick={() => onPick(t.id)}>
              <span className="explore-num">{i + 1}</span>
              <span className="explore-topic">{t.title}</span>
              <small className="explore-count" title="Visto u hecho, del total">
                {p.done}/{p.total}
              </small>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Lo hecho (lecciones terminadas, problemas resueltos) y lo aún no abierto. */
function useDone() {
  const { lessons: doneLessons, problems: solved, seen } = useProgress();
  const isDone = (x: CatalogItem) =>
    x.kind === 'leccion' ? doneLessons.includes(x.id) : x.kind === 'problema' && !!solved[x.id];
  const isNew = (x: CatalogItem) => !seen.includes(itemKey(x)) && !isDone(x);
  return { isDone, isNew, seen };
}

function useTopicProgress() {
  const { isDone, seen } = useDone();
  return (t: TopicId) => {
    const items = catalog.filter((x) => x.topic === t && x.kind !== 'teoria');
    const done = items.filter((x) => isDone(x) || seen.includes(itemKey(x))).length;
    return { done, total: items.length };
  };
}

function Listing({
  filters: { kind, level, audience },
  topic,
  query,
  onFilter,
  onPick,
}: {
  filters: ListFilters;
  topic: TopicId | 'todos';
  query: string;
  onFilter(f: Partial<ListFilters>): void;
  onPick(x: CatalogItem): void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      catalog.filter(
        (x) =>
          (kind === 'todo' || x.kind === kind) &&
          (level === 'todos' || x.level === level) &&
          (audience === 'todos' || x.audience.includes(audience)) &&
          (!q || x.haystack.includes(q) || x.title.toLowerCase().includes(q)),
      ),
    [kind, level, audience, q],
  );
  const shown = topic === 'todos' ? topics : topics.filter((t) => t.id === topic);

  return (
    <>
      <header>
        <div className="explore-filters">
          <div className="chips" role="group" aria-label="Tipo de contenido">
            {KINDS.map((k) => (
              <button
                key={k.id}
                className={`chip${kind === k.id ? ' is-on' : ''}`}
                aria-pressed={kind === k.id}
                onClick={() => onFilter({ kind: k.id })}
              >
                {k.title}
              </button>
            ))}
          </div>
          <div className="explore-selects">
            <select
              aria-label="Nivel"
              value={level}
              onChange={(e) => onFilter({ level: e.target.value as Level | 'todos' })}
            >
              <option value="todos">Cualquier nivel</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Para qué"
              value={audience}
              onChange={(e) => onFilter({ audience: e.target.value as Audience | 'todos' })}
            >
              <option value="todos">Para todo</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-quiet" onClick={explore.close} aria-label="Cerrar">
          Cerrar
        </button>
      </header>

      {shown.map((t) => {
        const items = filtered.filter((x) => x.topic === t.id);
        if (!items.length) return null;
        return (
          <section key={t.id} className="explore-topic-section">
            <h3>{t.title}</h3>
            <p className="explore-summary">{t.summary}</p>
            <ItemList items={items} onPick={onPick} />
          </section>
        );
      })}
      {!shown.some((t) => filtered.some((x) => x.topic === t.id)) && (
        <p className="explore-empty">
          No hay nada con esos filtros. Prueba a quitar alguno o a buscar otra palabra.
        </p>
      )}
    </>
  );
}

function ItemList({ items, onPick }: { items: CatalogItem[]; onPick(x: CatalogItem): void }) {
  const { isDone, isNew } = useDone();
  return (
    <ol className="explore-items">
      {items.map((x) => (
        <li key={itemKey(x)}>
          <button className={`explore-item kind-${x.kind}`} onClick={() => onPick(x)}>
            <span className="explore-kind">{KIND_LABEL[x.kind]}</span>
            <strong>{x.title}</strong>
            <span className="explore-text">{x.summary}</span>
            <small className="explore-meta">
              {LEVEL_LABEL[x.level]}
              {x.minutes ? ` · ${x.minutes} min` : ''}
              {isDone(x) && <span className="pill pill-positive">Hecho</span>}
              {isNew(x) && x.kind !== 'teoria' && <span className="pill pill-neutral">Nuevo</span>}
            </small>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Para practicar lo que cuenta la ficha: lecciones, ejemplos y problemas que
 * la tocan y, si son pocos, lo demás de su tema. Sale solo de los metadatos.
 */
function Practice({ conceptId, onPick }: { conceptId: string; onPick(x: CatalogItem): void }) {
  const items = useMemo(() => {
    const topic = topicOfConcept(conceptId);
    const practice = catalog.filter((x) => x.kind !== 'teoria');
    const direct = practice.filter((x) => x.concepts.includes(conceptId));
    const sameTopic = practice.filter((x) => x.topic === topic && !direct.includes(x));
    return [...direct, ...(direct.length < 3 ? sameTopic : [])].slice(0, 6);
  }, [conceptId]);
  if (!items.length) return null;
  return (
    <section>
      <h3>Para practicarlo</h3>
      <ItemList items={items} onPick={onPick} />
    </section>
  );
}

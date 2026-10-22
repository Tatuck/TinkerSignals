import { seededRandom as seededRand } from '@/blocks/_shared/random';
import { conceptById, concepts } from '@/theory/es';
import { plainText } from './richText';
import { byStudyOrder, topicOfConcept, topics } from './topics';
import type { Graph, RunResult } from '@/engine/types';
import type {
  Audience,
  Circuit,
  Example,
  Lesson,
  Level,
  Problem,
  ProblemAnswer,
  SolveContext,
  TopicId,
} from './types';

/**
 * Autodescubrimiento del contenido didáctico, igual que con los bloques:
 * cada fichero `src/content/<tipo>/<id>.ts` con un `export default` aparece
 * en el catálogo. El id debe coincidir con el nombre del fichero.
 */
function discover<T extends { id: string }>(modules: Record<string, { default: T }>): T[] {
  return Object.entries(modules).map(([path, m]) => {
    const file = path.split('/').pop()!.replace(/\.ts$/, '');
    if (m.default.id !== file) {
      throw new Error(`«${path}» tiene id "${m.default.id}"; debe ser "${file}"`);
    }
    return m.default;
  });
}

export const examples: Example[] = discover(
  import.meta.glob<{ default: Example }>('./examples/*.ts', { eager: true }),
).sort(byStudyOrder);

export const lessons: Lesson[] = discover(
  import.meta.glob<{ default: Lesson }>('./lessons/*.ts', { eager: true }),
).sort(byStudyOrder);

export const problems: Problem[] = discover(
  import.meta.glob<{ default: Problem }>('./problems/*.ts', { eager: true }),
).sort(byStudyOrder);

/** Circuito con el que se abre la aplicación la primera vez. */
export const DEFAULT_EXAMPLE = 'cuantizacion';

export const exampleById = (id: string) => examples.find((e) => e.id === id);
export const lessonById = (id: string) => lessons.find((l) => l.id === id);
export const problemById = (id: string) => problems.find((p) => p.id === id);

// ─── Catálogo ───────────────────────────────────────────────────────────────

export type ItemKind = 'leccion' | 'ejemplo' | 'problema' | 'teoria';

/** Una entrada del catálogo, sea del tipo que sea. */
export interface CatalogItem {
  kind: ItemKind;
  id: string;
  title: string;
  summary: string;
  topic: TopicId;
  level: Level;
  audience: Audience[];
  /** Texto en el que busca el buscador. */
  haystack: string;
  /** Fichas de teoría que toca (para sugerir contenido relacionado). */
  concepts: string[];
  /** Minutos aproximados (lecciones). */
  minutes?: number;
  order?: number;
}

/** Fichas que menciona un texto enriquecido o una lección. */
function conceptsOfLesson(l: Lesson): string[] {
  const ids = new Set<string>();
  for (const s of l.steps) {
    if (s.theory) ids.add(s.theory);
    for (const m of s.text.matchAll(/\|c:([\w-]+)\]\]/g)) ids.add(m[1]);
  }
  return [...ids];
}

/** Fichas de los bloques que usa un circuito (por las etiquetas `concepts` de cada bloque). */
type ConceptsOfBlock = (type: string) => string[];

export function buildCatalog(conceptsOfBlock: ConceptsOfBlock): CatalogItem[] {
  const ofCircuit = (types: string[]) => [...new Set(types.flatMap(conceptsOfBlock))];
  const items: CatalogItem[] = [];
  for (const l of lessons) {
    const ex = l.example ? exampleById(l.example) : undefined;
    items.push({
      kind: 'leccion',
      id: l.id,
      title: l.title,
      summary: l.summary,
      topic: l.topic,
      level: l.level,
      audience: l.audience ?? ['estudiar'],
      haystack: [l.title, l.summary, ...(l.tags ?? []), ...l.steps.map((s) => plainText(s.text))]
        .join(' ')
        .toLowerCase(),
      concepts: [
        ...new Set([...conceptsOfLesson(l), ...ofCircuit(ex?.nodes.map((n) => n.type) ?? [])]),
      ],
      minutes: l.minutes,
      order: l.order,
    });
  }
  for (const e of examples) {
    items.push({
      kind: 'ejemplo',
      id: e.id,
      title: e.title,
      summary: e.description,
      topic: e.topic,
      level: e.level,
      audience: e.audience ?? ['curiosear'],
      haystack: [e.title, e.description, ...(e.tags ?? [])].join(' ').toLowerCase(),
      concepts: ofCircuit(e.nodes.map((n) => n.type)),
      order: e.order,
    });
  }
  for (const p of problems) {
    items.push({
      kind: 'problema',
      id: p.id,
      title: p.title,
      // El primer párrafo del enunciado (con datos de una semilla fija) hace de resumen.
      summary: plainText(p.statement(p.generate(seededRand(1))).split(/\n\s*\n/)[0]).slice(0, 160),
      topic: p.topic,
      level: p.level,
      audience: p.audience ?? ['estudiar'],
      haystack: [p.title, ...(p.tags ?? [])].join(' ').toLowerCase(),
      concepts: ofCircuit(p.circuit?.(p.generate(seededRand(1))).nodes.map((n) => n.type) ?? []),
      order: p.order,
    });
  }
  for (const c of concepts) {
    const topic = topicOfConcept(c.id);
    if (!topic) continue;
    const t = topics.find((x) => x.id === topic)!;
    items.push({
      kind: 'teoria',
      id: c.id,
      title: c.title,
      summary: c.body[0],
      topic,
      level: 'basico',
      audience: ['estudiar', 'curiosear'],
      haystack: [c.title, ...c.aliases, ...c.body].join(' ').toLowerCase(),
      concepts: [c.id],
      order: t.concepts.indexOf(c.id),
    });
  }
  return items.sort(
    (a, b) => byStudyOrder(a, b) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
}

/** En cada tema: primero la teoría, después lecciones, ejemplos y problemas. */
export const KIND_ORDER: ItemKind[] = ['teoria', 'leccion', 'ejemplo', 'problema'];

/**
 * Qué hacer después de una entrada: lo siguiente del mismo tema y lo que
 * comparte fichas de teoría con ella en otros temas. Sale solo de los
 * metadatos; no hay enlaces escritos a mano.
 */
export function related(item: CatalogItem, all: CatalogItem[], max = 4): CatalogItem[] {
  const same = all.filter((x) => x.topic === item.topic && x !== item && x.kind !== 'teoria');
  const next = same.filter((x) => byStudyOrder(x, item) > 0);
  const shared = all
    .filter((x) => x.topic !== item.topic && x.kind !== 'teoria')
    .map((x) => ({ x, n: x.concepts.filter((c) => item.concepts.includes(c)).length }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((s) => s.x);
  const out: CatalogItem[] = [];
  for (const x of [...next, ...shared, ...same]) {
    if (!out.includes(x)) out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

export { conceptById, seededRand };

// ─── Problemas: del circuito descrito como datos a sus respuestas ───────────

/** Circuito descrito como datos → grafo del motor (el motor pone los parámetros por defecto). */
export function circuitToGraph(c: Circuit): Graph {
  return {
    nodes: c.nodes.map((n) => ({ id: n.id, type: n.type, params: n.params ?? {} })),
    edges: c.edges.map(([s, sp, d, dp], i) => ({
      id: `e${i}`,
      source: s,
      sourcePort: sp,
      target: d,
      targetPort: dp,
    })),
  };
}

/** Lo que un problema lee del resultado de su circuito. */
export function solveContext(r: RunResult | null): SolveContext {
  return {
    metric: (id, key) => r?.nodes[id]?.metrics.find((m) => m.key === key)?.value,
    table(id, title) {
      const p = r?.nodes[id]?.plots.find((x) => x.kind === 'table' && x.title === title);
      return p?.kind === 'table' ? { columns: p.columns, rows: p.rows } : undefined;
    },
  };
}

/** Valores correctos de cada hueco del problema. */
export function expectedAnswers(
  p: Problem,
  data: unknown,
  r: RunResult | null,
): Record<string, number | string | undefined> {
  const ctx = solveContext(r);
  return Object.fromEntries(p.answers.map((a) => [a.key, a.solve(data, ctx)]));
}

/** ¿Es correcta la respuesta escrita? */
export function isCorrect(
  a: Pick<ProblemAnswer<unknown>, 'kind' | 'tolerance'>,
  expected: number | string | undefined,
  given: string,
): boolean {
  if (expected === undefined || !given.trim()) return false;
  if (a.kind === 'text' || typeof expected === 'string') {
    const norm = (s: string) =>
      s
        .replace(/[\s|·,]/g, '')
        .replace(/−/g, '-')
        .toLowerCase();
    return norm(given) === norm(String(expected));
  }
  const v = parseNumber(given);
  if (v === null) return false;
  const tol = a.tolerance ?? Math.max(0.01, Math.abs(expected) * 0.005);
  return Math.abs(v - expected) <= tol + 1e-9;
}

/** Número escrito por una persona: admite coma decimal, puntos de miles y notación 1e3. */
export function parseNumber(s: string): number | null {
  let t = s.trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  const v = Number(t);
  return t !== '' && Number.isFinite(v) ? v : null;
}

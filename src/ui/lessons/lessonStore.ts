import { create } from 'zustand';
import { lessonById } from '@/content';
import type { Focus, Lesson, LessonContext, LessonStep } from '@/content/types';
import { instantiate, exampleById } from '../examples';
import { mergeFocus, setFocus } from '../focus/focus';
import { useProgress } from '../lib/progress';
import { useStore } from '../store';

interface LessonState {
  lesson: Lesson | null;
  step: number;
  /** Opción elegida en la predicción de cada paso (índice del paso → opción). */
  answers: Record<number, number>;
  /** La lección se ha terminado y se enseña qué hacer después. */
  finished: boolean;
  /** Empieza una lección del catálogo (por id) o una generada al vuelo. */
  start(lesson: string | Lesson): void;
  go(step: number): void;
  answer(step: number, option: number): void;
  finish(): void;
  exit(): void;
}

export const useLesson = create<LessonState>((set, get) => ({
  lesson: null,
  step: 0,
  answers: {},
  finished: false,
  start(ref) {
    const lesson = typeof ref === 'string' ? lessonById(ref) : ref;
    if (!lesson) return;
    if (lesson.example) {
      const ex = exampleById(lesson.example);
      if (!ex) return;
      const g = instantiate(ex);
      useStore.getState().load(g.nodes, g.edges);
    }
    set({ lesson, step: 0, answers: {}, finished: false });
    showStep(lesson, 0);
  },
  go(step) {
    const { lesson } = get();
    if (!lesson) return;
    const s = Math.max(0, Math.min(lesson.steps.length - 1, step));
    set({ step: s, finished: false });
    showStep(lesson, s);
  },
  answer(step, option) {
    set({ answers: { ...get().answers, [step]: option } });
  },
  finish() {
    const { lesson } = get();
    if (!lesson) return;
    if (!lesson.id.startsWith('_')) useProgress.getState().finishLesson(lesson.id);
    set({ finished: true });
    setFocus('lesson', null);
  },
  exit() {
    set({ lesson: null, step: 0, answers: {}, finished: false });
    setFocus('lesson', null);
  },
}));

/** Todo lo que resalta un paso: su `focus` más los atajos `node` y `param`. */
export function stepFocus(s: LessonStep): Focus {
  return mergeFocus(
    s.focus,
    s.node ? { nodes: [s.node] } : undefined,
    s.node && s.param ? { params: [{ node: s.node, key: s.param }] } : undefined,
  );
}

/** Resalta lo que nombra el paso y selecciona su bloque para que el panel lateral lo explique. */
function showStep(lesson: Lesson, step: number) {
  const s = lesson.steps[step];
  setFocus('lesson', stepFocus(s));
  const node = s.node ?? s.focus?.nodes?.[0];
  if (node && useStore.getState().nodes.some((n) => n.id === node))
    useStore.getState().select({ kind: 'node', id: node });
}

/** Contexto para evaluar los `check` de los pasos contra el estado actual. */
export function lessonContext(): LessonContext {
  const { nodes, edges, results } = useStore.getState();
  return {
    param: (id, key) => nodes.find((n) => n.id === id)?.data.params[key],
    metric: (id, key) => results?.nodes[id]?.metrics.find((m) => m.key === key)?.value,
    hasEdge: (s, t) => edges.some((e) => e.source === s && e.target === t),
    nodeOfType: (type) => nodes.find((n) => n.data.blockType === type)?.id,
  };
}

import { create } from 'zustand';
import { examples, instantiate } from '../examples';
import { useStore } from '../store';
import { lessons, type Lesson, type LessonContext } from './lessons';

interface LessonState {
  lesson: Lesson | null;
  step: number;
  start(id: string): void;
  go(step: number): void;
  exit(): void;
}

export const useLesson = create<LessonState>((set, get) => ({
  lesson: null,
  step: 0,
  start(id) {
    const lesson = lessons.find((l) => l.id === id);
    const ex = lesson && examples.find((e) => e.id === lesson.example);
    if (!lesson || !ex) return;
    const g = instantiate(ex);
    useStore.getState().load(g.nodes, g.edges);
    set({ lesson, step: 0 });
    focusStep(lesson, 0);
  },
  go(step) {
    const { lesson } = get();
    if (!lesson) return;
    const s = Math.max(0, Math.min(lesson.steps.length - 1, step));
    set({ step: s });
    focusStep(lesson, s);
  },
  exit: () => set({ lesson: null, step: 0 }),
}));

/** Selecciona el bloque del paso para que el panel lateral muestre su explicación. */
function focusStep(lesson: Lesson, step: number) {
  const node = lesson.steps[step].node;
  if (node) useStore.getState().select({ kind: 'node', id: node });
}

/** Contexto para evaluar los `check` de los pasos contra el estado actual. */
export function lessonContext(): LessonContext {
  const { nodes, edges, results } = useStore.getState();
  return {
    param: (id, key) => nodes.find((n) => n.id === id)?.data.params[key],
    metric: (id, key) => results?.nodes[id]?.metrics.find((m) => m.key === key)?.value,
    hasEdge: (s, t) => edges.some((e) => e.source === s && e.target === t),
  };
}

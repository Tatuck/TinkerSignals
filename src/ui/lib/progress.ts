import { create } from 'zustand';

/**
 * Progreso de quien usa la aplicación: lecciones terminadas, problemas
 * resueltos y qué ha abierto ya del catálogo. Vive en el navegador
 * (localStorage); si no hay almacenamiento, funciona igual sin recordarlo.
 */
const KEY = 'tinkersignals:progress';

interface Saved {
  /** Lecciones terminadas. */
  lessons: string[];
  /** Problemas resueltos: id → veces. */
  problems: Record<string, number>;
  /** Entradas del catálogo abiertas alguna vez ('tipo:id'). */
  seen: string[];
}

interface ProgressState extends Saved {
  finishLesson(id: string): void;
  solveProblem(id: string): void;
  markSeen(key: string): void;
  reset(): void;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      return { lessons: s.lessons ?? [], problems: s.problems ?? {}, seen: s.seen ?? [] };
    }
  } catch {
    /* sin almacenamiento */
  }
  return { lessons: [], problems: {}, seen: [] };
}

function save(s: Saved) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ lessons: s.lessons, problems: s.problems, seen: s.seen }),
    );
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export const useProgress = create<ProgressState>((set, get) => ({
  ...load(),
  finishLesson(id) {
    if (get().lessons.includes(id)) return;
    set({ lessons: [...get().lessons, id] });
    save(get());
  },
  solveProblem(id) {
    const problems = { ...get().problems, [id]: (get().problems[id] ?? 0) + 1 };
    set({ problems });
    save(get());
  },
  markSeen(key) {
    if (get().seen.includes(key)) return;
    set({ seen: [...get().seen, key] });
    save(get());
  },
  reset() {
    set({ lessons: [], problems: {}, seen: [] });
    save(get());
  },
}));

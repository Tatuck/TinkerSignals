import { create } from 'zustand';
import {
  circuitToGraph,
  expectedAnswers,
  isCorrect,
  problemById,
  seededRand,
  solveContext,
} from '@/content';
import type { Problem, SolveContext } from '@/content/types';
import type { RunResult } from '@/engine/types';
import { engine } from '@/runtime/client';
import { instantiate } from '../examples';
import { useProgress } from '../lib/progress';
import { useStore } from '../store';

interface ProblemState {
  problem: Problem | null;
  seed: number;
  data: unknown;
  /** ¿Se ve el enunciado? (Al llevarlo al laboratorio se oculta, pero sigue abierto.) */
  visible: boolean;
  inputs: Record<string, string>;
  /** Resultado de corregir: hueco → acierto. Vacío hasta pulsar «Corregir». */
  marks: Record<string, boolean>;
  revealed: boolean;
  hints: number;
  /** Resultado del circuito que resuelve el problema (motor aparte). */
  result: RunResult | null;
  expected: Record<string, number | string | undefined>;
  ctx: SolveContext;
  open(id: string, seed?: number): void;
  another(): void;
  setInput(key: string, value: string): void;
  check(): void;
  reveal(): void;
  hint(): void;
  /** Carga en el lienzo el circuito que resuelve el problema. */
  toLab(): void;
  show(): void;
  close(): void;
}

const newSeed = () => 1 + Math.floor(Math.random() * 1e6);

export const useProblem = create<ProblemState>((set, get) => ({
  problem: null,
  seed: 1,
  data: null,
  visible: false,
  inputs: {},
  marks: {},
  revealed: false,
  hints: 0,
  result: null,
  expected: {},
  ctx: solveContext(null),

  open(id, seed = newSeed()) {
    const problem = problemById(id);
    if (!problem) return;
    const data = problem.generate(seededRand(seed));
    set({
      problem,
      seed,
      data,
      visible: true,
      inputs: {},
      marks: {},
      revealed: false,
      hints: 0,
      result: null,
      expected: expectedAnswers(problem, data, null),
      ctx: solveContext(null),
    });
    if (problem.circuit) {
      const graph = circuitToGraph(problem.circuit(data));
      void engine.run(graph, 'scratch').then((result) => {
        // Si mientras tanto se ha abierto otro problema, este resultado ya no vale.
        if (get().problem !== problem || get().seed !== seed) return;
        set({
          result,
          expected: expectedAnswers(problem, data, result),
          ctx: solveContext(result),
        });
      });
    }
  },
  another() {
    const p = get().problem;
    if (p) get().open(p.id);
  },
  setInput(key, value) {
    set({ inputs: { ...get().inputs, [key]: value } });
  },
  check() {
    const { problem, expected, inputs } = get();
    if (!problem) return;
    const marks = Object.fromEntries(
      problem.answers.map((a) => [a.key, isCorrect(a, expected[a.key], inputs[a.key] ?? '')]),
    );
    set({ marks });
    if (Object.values(marks).every(Boolean)) useProgress.getState().solveProblem(problem.id);
  },
  reveal: () => set({ revealed: true }),
  hint: () => set({ hints: get().hints + 1 }),
  toLab() {
    const { problem, data } = get();
    if (!problem?.circuit) return;
    const g = instantiate({ id: problem.id, ...problem.circuit(data) });
    useStore.getState().load(g.nodes, g.edges);
    set({ visible: false });
  },
  show: () => set({ visible: true }),
  close: () => set({ problem: null, visible: false }),
}));

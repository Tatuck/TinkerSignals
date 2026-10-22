import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@/blocks/index';
import { Engine } from '@/engine/evaluator';
import { conceptById } from '@/theory/es';
import { circuitToGraph, exampleById, lessons } from './index';
import { richTargets } from './richText';
import type { Focus, LessonStep } from './types';

/**
 * Todo lo que una lección nombra tiene que existir en su ejemplo: bloques,
 * cables, parámetros, métricas y fichas de teoría. Si alguien cambia un
 * ejemplo o un bloque, este test dice qué lección se ha quedado colgando.
 */
const registry = createRegistry();

/** Todos los textos enriquecidos de un paso. */
const texts = (s: LessonStep) => [
  s.text,
  ...(s.predict ? [s.predict.question, s.predict.explain, ...s.predict.options] : []),
];

describe('lecciones', () => {
  it('ids únicos', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
  });

  for (const lesson of lessons)
    it(`«${lesson.id}» solo nombra cosas que existen`, () => {
      expect(lesson.steps.length).toBeGreaterThan(0);
      const ex = lesson.example ? exampleById(lesson.example) : undefined;
      if (lesson.example) expect(ex, `ejemplo ${lesson.example}`).toBeDefined();
      const result = ex ? new Engine(registry).run(circuitToGraph(ex)) : null;
      const typeOf = (id: string) => ex?.nodes.find((n) => n.id === id)?.type;

      const where = (i: number) => `${lesson.id}, paso ${i + 1}`;
      const expectNode = (id: string, i: number) =>
        expect(typeOf(id), `${where(i)}: bloque «${id}»`).toBeDefined();
      const expectParam = (node: string, key: string, i: number) => {
        expectNode(node, i);
        expect(
          registry.get(typeOf(node)!)?.params[key],
          `${where(i)}: parámetro ${node}.${key}`,
        ).toBeDefined();
      };
      const expectFocus = (f: Focus, i: number) => {
        for (const n of f.nodes ?? []) expectNode(n, i);
        for (const e of f.edges ?? []) {
          const [s, t] = e.split('>');
          expect(
            ex?.edges.some(([a, , b]) => a === s && b === t),
            `${where(i)}: cable ${e}`,
          ).toBe(true);
        }
        for (const p of f.params ?? []) expectParam(p.node, p.key, i);
        for (const m of f.metrics ?? []) {
          expectNode(m.node, i);
          expect(
            result?.nodes[m.node]?.metrics.some((x) => x.key === m.key),
            `${where(i)}: métrica ${m.node}.${m.key}`,
          ).toBe(true);
        }
      };

      lesson.steps.forEach((s, i) => {
        if (s.node) expectNode(s.node, i);
        if (s.param) expectParam(s.node!, s.param, i);
        if (s.focus) expectFocus(s.focus, i);
        if (s.theory) expect(conceptById(s.theory), `${where(i)}: ficha ${s.theory}`).toBeDefined();
        if (s.predict) {
          expect(s.predict.answer).toBeGreaterThanOrEqual(0);
          expect(s.predict.answer).toBeLessThan(s.predict.options.length);
        }
        for (const t of texts(s)) {
          const targets = richTargets(t);
          for (const f of targets.focus) expectFocus(f, i);
          for (const c of targets.concepts)
            expect(conceptById(c), `${where(i)}: ficha ${c}`).toBeDefined();
          for (const tex of targets.tex)
            expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow();
        }
      });
    });
});

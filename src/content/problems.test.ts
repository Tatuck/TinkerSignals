import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@/blocks/index';
import { Engine } from '@/engine/evaluator';
import { validateGraph } from '@/engine/graph';
import {
  circuitToGraph,
  expectedAnswers,
  isCorrect,
  problemById,
  problems,
  seededRand,
  solveContext,
} from './index';
import { richTargets } from './richText';
import type { Problem } from './types';

/**
 * Cada problema, con muchas semillas: el enunciado sale, el circuito que lo
 * resuelve es válido y funciona con los bloques reales, todas las respuestas
 * tienen valor y la propia solución se da por buena.
 */
const registry = createRegistry();

function solve(p: Problem, seed: number) {
  const data = p.generate(seededRand(seed));
  const result = p.circuit ? new Engine(registry).run(circuitToGraph(p.circuit(data))) : null;
  return { data, result, expected: expectedAnswers(p, data, result), ctx: solveContext(result) };
}

/** Todas las fórmulas de un texto enriquecido se pueden pintar. */
function expectTex(text: string) {
  for (const tex of richTargets(text).tex)
    expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow();
}

describe('problemas', () => {
  it('hay problemas y sus ids no se repiten', () => {
    expect(problems.length).toBeGreaterThan(10);
    expect(new Set(problems.map((p) => p.id)).size).toBe(problems.length);
  });

  for (const p of problems)
    it(`${p.id}: 20 semillas dan un problema resoluble`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const { data, result, expected, ctx } = solve(p, seed);
        if (p.circuit) {
          const graph = circuitToGraph(p.circuit(data));
          expect(validateGraph(graph, registry).errors ?? []).toEqual([]);
          for (const [id, node] of Object.entries(result!.nodes))
            expect(node.status, `${p.id} (semilla ${seed}): ${id} ${node.error ?? ''}`).toBe('ok');
          for (const [node, title] of p.solutionTables ?? [])
            expect(ctx.table(node, title), `${node}/${title}`).toBeDefined();
        }
        const statement = p.statement(data);
        expect(statement.length).toBeGreaterThan(20);
        expectTex(statement);
        for (const h of p.hints?.(data) ?? []) expectTex(h);
        if (p.explain) expectTex(p.explain(data, ctx));
        for (const t of p.tables?.(data, ctx) ?? []) {
          expect(t.rows.length).toBeGreaterThan(0);
          for (const c of t.columns) expectTex(c);
        }
        for (const a of p.answers) {
          expectTex(a.label);
          const v = expected[a.key];
          expect(v, `${p.id} (semilla ${seed}): ${a.key}`).toBeDefined();
          if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
          // La propia solución, escrita como la escribiría alguien, se da por buena.
          const typed = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
          expect(isCorrect(a, v, typed), `${p.id}: ${a.key} = ${typed}`).toBe(true);
        }
      }
    });
});

describe('ejercicios hechos a mano', () => {
  const answers = (id: string, data: unknown) => {
    const p = problemById(id)!;
    const result = p.circuit ? new Engine(registry).run(circuitToGraph(p.circuit(data))) : null;
    return expectedAnswers(p, data, result);
  };

  it('PCM: −8 a 8 V con 16 niveles', () => {
    const a = answers('pcm-codigos', { V: 8, bits: 4, samples: [4.3, -2.6, 5.7, -6.2] });
    // −6,2 V → −0,775 cae en el escalón 1 (centro −0,8125): 0001.
    expect([a.c0, a.c1, a.c2, a.c3]).toEqual(['1100', '0101', '1101', '0001']);
  });

  it('DPCM de 2 bits: 150, 160, 162, 175, 163, 170', () => {
    const a = answers('dpcm-2-bits', { samples: [150, 160, 162, 175, 163, 170] });
    expect(a.bits).toBe('10010110 11 11 11 10 11');
    expect(a.last).toBe(167);
    expect(a.cr as number).toBeCloseTo(48 / 18, 6);
  });

  it('DPCM con paso 0,2 y redondeo hacia abajo en las mitades', () => {
    const a = answers('dpcm-paso', {
      step: 0.2,
      samples: [0.1, 0.09, -0.05, -0.15, -0.5, 0.8, 0.3],
    });
    // 0,1/0,2 = 0,5 → 0; 0,09 → 0; −0,05/0,2 = −0,25 → 0; −0,15 → −1 (−0,75);
    // −0,5 − (−0,2) = −0,3 → −1,5 → −2; 0,8 − (−0,6) = 1,4 → 7; 0,3 − 0,8 = −0,5 → −2,5 → −3.
    expect(a.codes).toBe('0, 0, 0, -1, -2, 7, -3');
    expect(a.last as number).toBeCloseTo(0.2, 9);
  });

  it('JPEG: los DC −988, −996, −993', () => {
    const a = answers('jpeg-dc', { dc: [-988, -996, -993] });
    // −988: categoría 10 (11111110) y amplitud 1023 − 988 = 35 → 0000100011.
    expect(a.dc0).toBe('11111110' + '0000100011');
    // −8: categoría 4 (101) y amplitud 0111; +3: categoría 2 (011) y 11.
    expect(a.dc1).toBe('101' + '0111');
    expect(a.dc2).toBe('011' + '11');
  });

  it('JPEG: AC con 14 ceros y EOB', () => {
    const ac = new Array<number>(63).fill(0);
    ac[0] = 1;
    ac[3] = -1;
    ac[18] = 2;
    const a = answers('jpeg-ac', { ac });
    expect(a.pairs).toBe('0/1 2/1 14/2 EOB');
    expect(a.amp).toBe(4);
  });
});

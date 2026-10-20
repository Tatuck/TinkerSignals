import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@/blocks';
import { conceptById, conceptFor, concepts } from './es';

const locales = import.meta.glob<{ default: { concepts?: string[] } }>('../blocks/*/locales/es.json', { eager: true });
const registry = createRegistry();

describe('teoría', () => {
  it('cada etiqueta de concepto de un bloque tiene su ficha', () => {
    const missing = Object.values(locales)
      .flatMap((m) => m.default.concepts ?? [])
      .filter((c) => !conceptFor(c));
    expect([...new Set(missing)]).toEqual([]);
  });

  it.each(concepts.map((c) => [c.id, c] as const))('la ficha «%s» es coherente', (_, c) => {
    for (const b of c.blocks) expect(registry.get(b), `bloque ${b}`).toBeDefined();
    for (const r of c.related) expect(conceptById(r), `ficha ${r}`).toBeDefined();
    for (const f of c.formulas) expect(() => katex.renderToString(f.tex, { throwOnError: true })).not.toThrow();
  });
});

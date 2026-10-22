import { describe, expect, it } from 'vitest';
import { concepts } from '@/theory/es';
import { buildCatalog, examples, lessons, problems, related } from './index';
import { plainText, texToPlain } from './richText';
import { levels, topicOfConcept, topics } from './topics';

/** La clasificación del contenido: todo tiene tema y nivel, y ningún tema se queda vacío. */
const catalog = buildCatalog(() => []);
const topicIds = new Set(topics.map((t) => t.id));
const levelIds = new Set(levels.map((l) => l.id));

describe('catálogo', () => {
  it('todo tiene un tema y un nivel válidos', () => {
    for (const x of [...examples, ...lessons, ...problems]) {
      expect(topicIds.has(x.topic), `${x.id}: tema ${x.topic}`).toBe(true);
      expect(levelIds.has(x.level), `${x.id}: nivel ${x.level}`).toBe(true);
    }
  });

  it('cada ficha de teoría está en un solo tema', () => {
    for (const c of concepts) {
      const owners = topics.filter((t) => t.concepts.includes(c.id));
      expect(
        owners.map((t) => t.id),
        c.id,
      ).toHaveLength(1);
      expect(topicOfConcept(c.id)).toBe(owners[0].id);
    }
    for (const t of topics)
      for (const id of t.concepts)
        expect(
          concepts.some((c) => c.id === id),
          `${t.id}: ${id}`,
        ).toBe(true);
  });

  it('ningún tema se queda sin algo que hacer', () => {
    for (const t of topics)
      expect(
        catalog.some((x) => x.topic === t.id && x.kind !== 'teoria'),
        `tema vacío: ${t.id}`,
      ).toBe(true);
  });

  it('los ids no se repiten dentro de cada tipo', () => {
    for (const kind of ['leccion', 'ejemplo', 'problema', 'teoria'] as const) {
      const ids = catalog.filter((x) => x.kind === kind).map((x) => x.id);
      expect(new Set(ids).size, kind).toBe(ids.length);
    }
  });

  it('lo relacionado nunca es la propia entrada ni teoría', () => {
    for (const x of catalog) {
      const r = related(x, catalog);
      expect(r).not.toContain(x);
      expect(r.every((y) => y.kind !== 'teoria')).toBe(true);
    }
  });
});

describe('texto llano', () => {
  it('las fórmulas se leen sin órdenes de TeX', () => {
    expect(texToPlain('f_s = 6{,}02\\,n + 1{,}76')).toBe('fs = 6,02 n + 1,76');
    expect(texToPlain('\\operatorname{sgn}(x)\\,\\mu')).toBe('sgn(x) μ');
    expect(plainText('Vale **$x = 0{,}3$** con [[el códec|n:enc]].')).toBe(
      'Vale x = 0,3 con el códec.',
    );
  });

  it('ningún resumen del catálogo enseña TeX', () => {
    for (const x of catalog) expect(x.summary, `${x.kind} ${x.id}`).not.toMatch(/\\[a-zA-Z]|\$/);
  });
});

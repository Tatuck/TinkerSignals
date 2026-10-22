import { buildCatalog, type CatalogItem } from '@/content';
import { blockText } from '@/i18n';
import { conceptFor } from '@/theory/es';

/**
 * Catálogo de todo el contenido (teoría, lecciones, ejemplos y problemas)
 * clasificado por temas. Las fichas que toca un circuito salen de las
 * etiquetas `concepts` de sus bloques.
 */
export const catalog: CatalogItem[] = buildCatalog((type) =>
  (blockText(type).concepts ?? []).flatMap((c) => {
    const id = conceptFor(c)?.id;
    return id ? [id] : [];
  }),
);

export const catalogItem = (kind: CatalogItem['kind'], id: string) =>
  catalog.find((x) => x.kind === kind && x.id === id);

/** Clave estable de una entrada (para el progreso «visto»). */
export const itemKey = (x: Pick<CatalogItem, 'kind' | 'id'>) => `${x.kind}:${x.id}`;

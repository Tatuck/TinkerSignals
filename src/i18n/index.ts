import es from './es.json';

/**
 * i18n mínimo: textos generales en `src/i18n/<idioma>.json` y textos de cada
 * bloque en `src/blocks/<id>/locales/<idioma>.json`. Para añadir un idioma
 * basta con crear esos ficheros y registrarlos aquí.
 */
type Dict = Record<string, unknown>;

export interface BlockText {
  title: string;
  summary: string;
  details?: string;
  tryThis?: string;
  ref?: string;
  ports?: Record<string, string>;
  params?: Record<string, { label: string; help?: string }>;
  options?: Record<string, Record<string, string>>;
  metrics?: Record<string, string>;
  plots?: Record<string, string>;
}

const ui: Dict = es;
const blockModules = import.meta.glob<{ default: BlockText }>('../blocks/*/locales/es.json', {
  eager: true,
});
const blocks: Record<string, BlockText> = Object.fromEntries(
  Object.entries(blockModules).map(([path, m]) => [path.split('/')[2], m.default]),
);

/** Texto de la interfaz por clave con puntos: t('toolbar.examples'). Admite {variables}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Dict | undefined)?.[k], ui);
  if (typeof v !== 'string') return key;
  return vars ? v.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : v;
}

export function tList(key: string): string[] {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Dict | undefined)?.[k], ui);
  return Array.isArray(v) ? (v as string[]) : [];
}

export function blockText(id: string): BlockText {
  return blocks[id] ?? { title: id, summary: '' };
}

/** Etiqueta de una métrica: primero la del bloque, después la común. */
export function metricLabel(blockId: string, key: string): string {
  return (
    blockText(blockId).metrics?.[key] ??
    (t(`metrics.${key}`) !== `metrics.${key}` ? t(`metrics.${key}`) : key)
  );
}

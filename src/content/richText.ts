import type { Focus } from './types';

/**
 * Texto enriquecido de lecciones, problemas y fichas. Es texto normal con
 * tres marcas:
 *
 *   **negrita**
 *   $x_q(n) = \hat x(n) + e_q(n)$          fórmula en línea (KaTeX)
 *   [[texto|destino]]                      enlace que resalta algo del lienzo
 *
 * Destinos de los enlaces (los ids son los de los nodos del circuito):
 *   n:enc,dec      bloques
 *   e:enc>dec      cables (varios separados por comas)
 *   p:enc.bits     un parámetro
 *   m:cmp.snr      una métrica
 *   c:dpcm         una ficha de teoría
 *
 * Un párrafo en blanco (\n\n) separa párrafos. Un párrafo que es solo
 * `$$…$$` es una fórmula aparte, y uno cuyas líneas empiezan todas por «- »
 * o por «1. » es una lista.
 */
export type RichToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'math'; tex: string }
  | { kind: 'link'; text: string; focus?: Focus; concept?: string };

const TOKEN = /\*\*(.+?)\*\*|\$([^$]+)\$|\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export type RichBlock =
  | { kind: 'p'; tokens: RichToken[] }
  | { kind: 'math'; tex: string }
  | { kind: 'list'; ordered: boolean; items: RichToken[][] };

const ITEM = /^\s*(-|\d+\.)\s+/;

/** El texto en bloques: párrafos, fórmulas aparte y listas. */
export function parseBlocks(src: string): RichBlock[] {
  return src.split(/\n\s*\n/).map((par): RichBlock => {
    const t = par.trim();
    const display = /^\$\$([\s\S]+)\$\$$/.exec(t);
    if (display) return { kind: 'math', tex: display[1].trim() };
    const lines = t.split('\n');
    if (lines.every((l) => ITEM.test(l)))
      return {
        kind: 'list',
        ordered: /^\s*\d/.test(lines[0]),
        items: lines.map((l) => parseParagraph(l.replace(ITEM, ''))),
      };
    return { kind: 'p', tokens: parseParagraph(par) };
  });
}

/** Párrafos de tokens (cada fórmula aparte y cada elemento de lista cuenta como uno). */
export function parseRich(src: string): RichToken[][] {
  return parseBlocks(src).flatMap((b) =>
    b.kind === 'p' ? [b.tokens] : b.kind === 'math' ? [[{ kind: 'math', tex: b.tex }]] : b.items,
  );
}

function parseParagraph(src: string): RichToken[] {
  const out: RichToken[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'math', tex: m[2] });
    else out.push({ kind: 'link', text: m[3], ...parseTarget(m[4]) });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

/** Convierte el destino de un enlace (`n:a,b`, `e:a>b`, `p:a.k`…) en foco o ficha. */
export function parseTarget(target: string): { focus?: Focus; concept?: string } {
  const sep = target.indexOf(':');
  const type = target.slice(0, sep);
  const items = target
    .slice(sep + 1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pairs = () =>
    items.map((s) => {
      const dot = s.indexOf('.');
      return { node: s.slice(0, dot), key: s.slice(dot + 1) };
    });
  switch (type) {
    case 'n':
      return { focus: { nodes: items } };
    case 'e':
      return { focus: { edges: items } };
    case 'p':
      return { focus: { params: pairs() } };
    case 'm':
      return { focus: { metrics: pairs() } };
    case 'c':
      return { concept: items[0] };
    default:
      return {};
  }
}

/** Todos los destinos de un texto (para comprobar en los tests que existen). */
export function richTargets(src: string): { focus: Focus[]; concepts: string[]; tex: string[] } {
  const focus: Focus[] = [];
  const concepts: string[] = [];
  const tex: string[] = [];
  for (const p of parseRich(src))
    for (const t of p) {
      if (t.kind === 'link' && t.focus) focus.push(t.focus);
      if (t.kind === 'link' && t.concept) concepts.push(t.concept);
      if (t.kind === 'math') tex.push(t.tex);
    }
  return { focus, concepts, tex };
}

/** Ids de nodo que nombra un foco (en bloques, cables, parámetros o métricas). */
export function focusNodes(f: Focus): string[] {
  return [
    ...(f.nodes ?? []),
    ...(f.edges ?? []).flatMap((e) => e.split('>')),
    ...(f.params ?? []).map((p) => p.node),
    ...(f.metrics ?? []).map((m) => m.node),
  ];
}

/** Texto sin marcas (para buscar, para resúmenes y para lectores de pantalla). */
export function plainText(src: string): string {
  return src
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, '$1')
    .replace(/\$\$?([^$]+)\$\$?/g, (_, tex: string) => texToPlain(tex));
}

/** Órdenes de TeX que tienen un carácter equivalente; las demás se quitan. */
const TEX_CHARS: Record<string, string> = {
  mu: 'μ',
  Delta: 'Δ',
  delta: 'δ',
  sigma: 'σ',
  pi: 'π',
  omega: 'ω',
  cdot: '·',
  times: '×',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  approx: '≈',
  to: '→',
  leftarrow: '←',
  infty: '∞',
  sum: 'Σ',
  quad: ' ',
};

/** Una fórmula como texto llano aproximado: «f_s = 8» → «fs = 8», «6{,}02» → «6,02». */
export function texToPlain(tex: string): string {
  return tex
    .replace(/\\(?:operatorname|text|mathrm|mathbf)\{([^}]*)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, (_, w: string) => TEX_CHARS[w] ?? '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[{}_^]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

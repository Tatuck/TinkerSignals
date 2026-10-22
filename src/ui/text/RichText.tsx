import { useReactFlow } from '@xyflow/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { parseBlocks, parseRich, focusNodes, type RichToken } from '@/content/richText';
import type { Focus } from '@/content/types';
import { conceptById } from '@/theory/es';
import { setFocus } from '../focus/focus';
import { useStore } from '../store';

/** Fórmula con KaTeX (el texto es nuestro, no del usuario). */
export function Formula({ tex, block }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: !!block, throwOnError: false }),
    [tex, block],
  );
  return block ? (
    <div className="formula" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="formula-inline" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/**
 * Lleva la vista a lo que nombra un foco y lo selecciona: el bloque (o el
 * cable) se abre en el panel lateral.
 */
export function useReveal() {
  const { fitView } = useReactFlow();
  return (focus: Focus) => {
    const { nodes, edges, select } = useStore.getState();
    const ids = [...new Set(focusNodes(focus))].filter((id) => nodes.some((n) => n.id === id));
    const edge = focus.edges?.[0]?.split('>');
    const e = edge && edges.find((x) => x.source === edge[0] && x.target === edge[1]);
    if (e) select({ kind: 'edge', id: e.id });
    else if (ids.length) select({ kind: 'node', id: ids[0] });
    if (ids.length)
      void fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.5,
        maxZoom: 1.1,
        duration: 400,
      });
  };
}

/**
 * Texto enriquecido (ver `content/richText.ts`): párrafos con negritas,
 * fórmulas en línea y enlaces que, al pasar por encima, resaltan bloques,
 * cables o parámetros del lienzo; al pulsarlos, los enseñan.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const tokens = (ts: RichToken[]) => ts.map((t, j) => <Token key={j} t={t} />);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'math') return <Formula key={i} tex={b.tex} block />;
        if (b.kind === 'p')
          return (
            <p key={i} className={className}>
              {tokens(b.tokens)}
            </p>
          );
        const List = b.ordered ? 'ol' : 'ul';
        return (
          <List key={i} className={`rich-list${className ? ` ${className}` : ''}`}>
            {b.items.map((item, j) => (
              <li key={j}>{tokens(item)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}

/** Lo mismo, en una sola línea (sin párrafos): para etiquetas y celdas. */
export function RichInline({ text }: { text: string }) {
  const tokens = useMemo(() => parseRich(text).flat(), [text]);
  return (
    <>
      {tokens.map((t, j) => (
        <Token key={j} t={t} />
      ))}
    </>
  );
}

function Token({ t }: { t: RichToken }) {
  const reveal = useReveal();
  // Si el enlace desaparece con el ratón encima (cambia el paso), no recibe
  // «mouseleave»: hay que quitar su resaltado al desmontarlo.
  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) setFocus('hover', null);
    },
    [],
  );
  const hover = (on: boolean, focus: Focus) => {
    hovering.current = on;
    setFocus('hover', on ? focus : null);
  };
  if (t.kind === 'text') return <Fragment>{t.text}</Fragment>;
  if (t.kind === 'bold') return <strong>{t.text}</strong>;
  if (t.kind === 'math') return <Formula tex={t.tex} />;
  if (t.concept) {
    const c = conceptById(t.concept);
    return (
      <button
        type="button"
        className="rich-link is-concept"
        title={c ? `Abrir la ficha «${c.title}»` : undefined}
        onClick={() => useStore.setState({ theory: t.concept! })}
      >
        {t.text}
      </button>
    );
  }
  const focus = t.focus;
  if (!focus) return <Fragment>{t.text}</Fragment>;
  return (
    <button
      type="button"
      className="rich-link"
      onMouseEnter={() => hover(true, focus)}
      onMouseLeave={() => hover(false, focus)}
      onFocus={() => hover(true, focus)}
      onBlur={() => hover(false, focus)}
      onClick={() => reveal(focus)}
    >
      {t.text}
    </button>
  );
}

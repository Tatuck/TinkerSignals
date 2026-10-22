import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { engine } from '@/runtime/client';
import { formatNumber } from './lib/format';
import { explore } from './explore/open';
import { canRedo, canUndo, onHistoryChange, redo, undo } from './history';
import { useLesson } from './lessons/lessonStore';
import { onPlaybackChange, play, stop } from './lib/audio';
import { encodeCircuit } from './lib/share';
import { useStore, type BlockNode, type CableEdge } from './store';

const NO_ERRORS: never[] = [];

/** Desplegable sencillo sobre <details>: se cierra al elegir una opción o al pulsar fuera. */
function Menu({
  label,
  wide,
  align = 'left',
  children,
}: {
  label: string;
  wide?: boolean;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = () => ref.current?.removeAttribute('open');
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <details className="menu" ref={ref}>
      <summary className="btn btn-quiet">
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="menu-caret">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <div
        className={`menu-list${wide ? ' is-wide' : ''}${align === 'right' ? ' is-right' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) ref.current?.removeAttribute('open');
        }}
      >
        {children}
      </div>
    </details>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Botón principal: escucha lo que llega al bloque Salida del circuito. */
function ListenButton() {
  const output = useStore((s) => s.nodes.find((n) => n.data.blockType === 'output')?.id);
  const ok = useStore((s) => !!output && s.results?.nodes[output]?.status === 'ok');
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => onPlaybackChange(setPlaying), []);
  const key = `${output}:in`;
  const isPlaying = playing === key;

  async function toggle() {
    if (!output) return;
    if (isPlaying) return stop();
    const s = await engine.getSignal(output, 'in', 'in');
    if (s) play(s, key);
  }

  return (
    <button
      className="btn btn-primary"
      onClick={toggle}
      disabled={!ok}
      title={output ? 'Escuchar lo que llega a la Salida' : 'Añade un bloque Salida para escuchar'}
    >
      {isPlaying ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 1.8v8.4L10 6z" fill="currentColor" strokeLinejoin="round" />
        </svg>
      )}
      {isPlaying ? 'Parar' : 'Escuchar salida'}
    </button>
  );
}

export function Toolbar() {
  const running = useStore((s) => s.running);
  const totalMs = useStore((s) => s.results?.totalMs);
  const graphErrors = useStore((s) => s.results?.graphErrors) ?? NO_ERRORS;
  const load = useStore((s) => s.load);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onHistoryChange(refresh), []);

  async function share() {
    const { nodes, edges, notify } = useStore.getState();
    const code = await encodeCircuit(nodes, edges);
    const url = `${location.origin}${location.pathname}#c=${code}`;
    const hasAudio = nodes.some(
      (n) => n.data.blockType === 'audio-file' || n.data.blockType === 'microphone',
    );
    try {
      await navigator.clipboard.writeText(url);
      notify(
        hasAudio
          ? 'Enlace copiado. Tus grabaciones y archivos no viajan en él.'
          : 'Enlace copiado.',
      );
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  }

  function exportGraph() {
    const { nodes, edges } = useStore.getState();
    const json = JSON.stringify({ version: 1, nodes, edges }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'circuito.tinkersignals.json';
    a.click();
  }

  async function importGraph(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { nodes: BlockNode[]; edges: CableEdge[] };
      load(data.nodes, data.edges);
    } catch {
      alert('El archivo no es un circuito válido de TinkerSignals.');
    }
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <rect width="28" height="28" rx="7" fill="#1A1D23" />
          <path
            d="M5 14c1.6-6 3.4-6 5 0s3.4 6 5 0"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M15 14h2v-4h2.5v8H22v-4h1.5"
            fill="none"
            stroke="#F2B230"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <h1>{t('app.name')}</h1>
        <span className={`run-status${running ? ' is-running' : ''}`} aria-live="polite">
          <span className="run-dot" aria-hidden />
          {running
            ? t('toolbar.running')
            : totalMs !== undefined
              ? t('toolbar.computedIn', { ms: formatNumber(totalMs, 0) })
              : t('toolbar.ready')}
        </span>
      </div>

      <nav className="toolbar-nav" aria-label="Aprender">
        <button className="btn btn-quiet" onClick={() => explore.open()}>
          Explorar
        </button>
        <button className="btn btn-quiet" onClick={() => explore.open('problema')}>
          Problemas
        </button>
        <button className="btn btn-quiet" onClick={() => explore.open('teoria')}>
          Teoría
        </button>
        <button className="btn btn-quiet" onClick={() => useStore.setState({ bench: true })}>
          <span>
            Comparar<span className="hide-sm"> códecs</span>
          </span>
        </button>
      </nav>

      <div className="toolbar-actions">
        <span className="toolbar-group" role="group" aria-label="Historial">
          <button
            className="btn btn-quiet btn-icon"
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer (Ctrl+Z)"
            aria-label="Deshacer"
          >
            <Icon d="M6 3 2.5 6.5 6 10M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" />
          </button>
          <button
            className="btn btn-quiet btn-icon"
            onClick={redo}
            disabled={!canRedo()}
            title="Rehacer (Ctrl+Mayús+Z)"
            aria-label="Rehacer"
          >
            <Icon d="M10 3l3.5 3.5L10 10M13 6.5H6.5a3.5 3.5 0 0 0 0 7H9" />
          </button>
        </span>
        <span className="toolbar-divider" aria-hidden />
        <Menu label="Archivo" align="right">
          {
            <>
              <button onClick={exportGraph}>{t('toolbar.export')}</button>
              <button onClick={() => fileRef.current?.click()}>{t('toolbar.import')}</button>
              <button
                className="is-danger"
                onClick={() => {
                  load([], []);
                  useLesson.getState().exit();
                }}
              >
                {t('toolbar.clear')}
              </button>
            </>
          }
        </Menu>
        <button className="btn" onClick={share}>
          Compartir
        </button>
        <ListenButton />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && importGraph(e.target.files[0])}
        />
      </div>

      {graphErrors.length > 0 && (
        <div className="graph-errors" role="alert">
          <strong>{t('graphErrors.title')}</strong>
          <ul>
            {graphErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

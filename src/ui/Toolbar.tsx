import { useEffect, useReducer, useRef } from 'react';
import { t } from '@/i18n';
import { formatNumber } from './lib/format';
import { examples, instantiate } from './examples';
import { canRedo, canUndo, onHistoryChange, redo, undo } from './history';
import { encodeCircuit } from './lib/share';
import { useStore, type BlockNode, type CableEdge } from './store';

const NO_ERRORS: never[] = [];

export function Toolbar({ onHome }: { onHome(): void }) {
  const running = useStore((s) => s.running);
  const totalMs = useStore((s) => s.results?.totalMs);
  const graphErrors = useStore((s) => s.results?.graphErrors) ?? NO_ERRORS;
  const load = useStore((s) => s.load);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute('open');
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onHistoryChange(refresh), []);
  // Cierra el menú «Archivo» al pulsar fuera de él.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        menuRef.current.removeAttribute('open');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

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
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
          <rect x="1" y="1" width="28" height="28" rx="8" fill="var(--ink)" />
          <path
            d="M5 15 Q8.5 5 12 15 T19 15"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M19 15 h2 v-4 h2 v8 h2 v-4"
            fill="none"
            stroke="#F2B230"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div>
          <h1>{t('app.name')}</h1>
          <p>{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="toolbar-actions">
        <button className="btn btn-quiet" onClick={onHome}>
          Inicio y lecciones
        </button>
        <label className="examples">
          <span className="sr-only">{t('toolbar.examples')}</span>
          <select
            value=""
            onChange={(e) => {
              const ex = examples.find((x) => x.id === e.target.value);
              if (ex) {
                const g = instantiate(ex);
                load(g.nodes, g.edges);
              }
            }}
          >
            <option value="" disabled>
              {t('toolbar.examples')}
            </option>
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id} title={ex.description}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-group" role="group" aria-label="Historial">
          <button
            className="btn btn-quiet btn-icon"
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer (Ctrl+Z)"
            aria-label="Deshacer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M6 3 2.5 6.5 6 10M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="btn btn-quiet btn-icon"
            onClick={redo}
            disabled={!canRedo()}
            title="Rehacer (Ctrl+Mayús+Z)"
            aria-label="Rehacer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M10 3l3.5 3.5L10 10M13 6.5H6.5a3.5 3.5 0 0 0 0 7H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </span>
        <button className="btn btn-quiet" onClick={share}>
          Compartir enlace
        </button>
        <details className="menu" ref={menuRef}>
          <summary className="btn btn-quiet">Archivo</summary>
          <div className="menu-list" role="menu">
            <button role="menuitem" onClick={() => (exportGraph(), closeMenu())}>
              {t('toolbar.export')}
            </button>
            <button role="menuitem" onClick={() => (fileRef.current?.click(), closeMenu())}>
              {t('toolbar.import')}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                load([], []);
                closeMenu();
              }}
            >
              {t('toolbar.clear')}
            </button>
          </div>
        </details>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && importGraph(e.target.files[0])}
        />
      </nav>

      <div className={`run-status${running ? ' is-running' : ''}`} aria-live="polite">
        <span className="run-dot" aria-hidden />
        {running
          ? t('toolbar.running')
          : totalMs !== undefined
            ? t('toolbar.computedIn', { ms: formatNumber(totalMs, 0) })
            : t('toolbar.ready')}
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

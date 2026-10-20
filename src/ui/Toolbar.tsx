import { useRef } from 'react';
import { t } from '@/i18n';
import { formatNumber } from './lib/format';
import { examples, instantiate } from './examples';
import { useStore, type BlockNode, type CableEdge } from './store';

const NO_ERRORS: never[] = [];

export function Toolbar({ onHome }: { onHome(): void }) {
  const running = useStore((s) => s.running);
  const totalMs = useStore((s) => s.results?.totalMs);
  const graphErrors = useStore((s) => s.results?.graphErrors) ?? NO_ERRORS;
  const load = useStore((s) => s.load);
  const fileRef = useRef<HTMLInputElement>(null);

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
        <button className="btn btn-quiet" onClick={exportGraph}>
          {t('toolbar.export')}
        </button>
        <button className="btn btn-quiet" onClick={() => fileRef.current?.click()}>
          {t('toolbar.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && importGraph(e.target.files[0])}
        />
        <button className="btn btn-quiet" onClick={() => load([], [])}>
          {t('toolbar.clear')}
        </button>
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

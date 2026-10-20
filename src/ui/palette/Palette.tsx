import { useReactFlow } from '@xyflow/react';
import { useMemo, useState, type CSSProperties } from 'react';
import { blockText, t } from '@/i18n';
import { DRAG_MIME } from '../canvas/Canvas';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor, categoryOrder } from '../theme';

/** Biblioteca de bloques agrupados por tema del temario. */
export function Palette() {
  const [query, setQuery] = useState('');
  const addBlock = useStore((s) => s.addBlock);
  const { screenToFlowPosition } = useReactFlow();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categoryOrder
      .map((cat) => ({
        cat,
        blocks: registry
          .list()
          .filter((b) => b.category === cat)
          .filter((b) => {
            if (!q) return true;
            const tx = blockText(b.id);
            return `${tx.title} ${tx.summary}`.toLowerCase().includes(q);
          })
          .sort((a, b) => sortKey(a.id).localeCompare(sortKey(b.id), 'es')),
      }))
      .filter((g) => g.blocks.length);
  }, [query]);

  function addAtCenter(type: string) {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    const jitter = () => (Math.random() - 0.5) * 80;
    addBlock(
      type,
      screenToFlowPosition({ x: canvas.left + canvas.width / 2 - 120 + jitter(), y: canvas.top + canvas.height / 2 - 80 + jitter() }),
    );
  }

  return (
    <aside className="palette" aria-label={t('palette.title')}>
      <h2 className="panel-title">{t('palette.title')}</h2>
      <input
        className="search"
        type="search"
        placeholder={t('palette.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="hint">{t('palette.hint')}</p>
      {groups.map(({ cat, blocks }) => (
        <section key={cat} className="palette-group" style={{ '--cat': categoryColor[cat] } as CSSProperties}>
          <h3>{t(`categories.${cat}`)}</h3>
          <ul>
            {blocks.map((b) => {
              const tx = blockText(b.id);
              return (
                <li key={b.id}>
                  <button
                    className="palette-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, b.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => addAtCenter(b.id)}
                    title={tx.summary}
                  >
                    <span className="palette-icon" aria-hidden>
                      {b.icon}
                    </span>
                    <span className="palette-text">
                      <strong>{tx.title}</strong>
                      <small>{tx.summary}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}

/** Orden alfabético, pero cada decodificador justo detrás de su codificador. */
function sortKey(id: string): string {
  const title = blockText(id).title;
  return title.startsWith('Decodificador')
    ? title.replace(/^Decodificador/, 'Codificador') + '~'
    : title;
}

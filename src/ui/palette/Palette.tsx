import { useReactFlow } from '@xyflow/react';
import { useMemo, useState, type CSSProperties } from 'react';
import { blockText, t } from '@/i18n';
import { DRAG_MIME } from '../canvas/Canvas';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor, categoryOrder } from '../theme';

/** Biblioteca de bloques agrupados por familia. */
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

  /**
   * Clic en la paleta: si hay un bloque seleccionado, el nuevo se coloca a su
   * derecha y se conecta a él si los tipos encajan (así se monta una cadena
   * solo con clics). Si no, se coloca a la derecha de todo lo que haya.
   */
  function addByClick(type: string) {
    const { nodes, selection, onConnect } = useStore.getState();
    const anchor =
      selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) : undefined;
    let position;
    if (anchor) {
      position = { x: anchor.position.x + 320, y: anchor.position.y };
    } else if (nodes.length) {
      const right = nodes.reduce((a, b) => (b.position.x > a.position.x ? b : a));
      position = { x: right.position.x + 320, y: right.position.y };
    } else {
      const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
      position = screenToFlowPosition({
        x: canvas.left + canvas.width / 2 - 120,
        y: canvas.top + canvas.height / 2 - 100,
      });
    }
    const id = addBlock(type, position);
    if (anchor) {
      const from = registry.get(anchor.data.blockType)!;
      const to = registry.get(type)!;
      const inPort = Object.entries(to.inputs).find(([, s]) => !s.optional)?.[0];
      const outPort =
        inPort &&
        Object.entries(from.outputs).find(([, s]) => s.type === to.inputs[inPort].type)?.[0];
      if (inPort && outPort) {
        onConnect({ source: anchor.id, sourceHandle: outPort, target: id, targetHandle: inPort });
      }
    }
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
        <section
          key={cat}
          className="palette-group"
          style={{ '--cat': categoryColor[cat] } as CSSProperties}
        >
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
                    onClick={() => addByClick(b.id)}
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

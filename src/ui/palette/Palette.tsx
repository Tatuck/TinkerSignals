import { useReactFlow, type XYPosition } from '@xyflow/react';
import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import type { AnyBlock, BlockCategory } from '@/engine/types';
import { blockText, t } from '@/i18n';
import { DRAG_MIME } from '../canvas/Canvas';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor, categoryOrder } from '../theme';
import { BlockGlyph } from '../BlockGlyph';

const OPEN_KEY = 'tinkersignals:palette-open';
const DEFAULT_OPEN: BlockCategory[] = ['entrada', 'digitalizacion'];

type Entry =
  { kind: 'single'; block: AnyBlock } | { kind: 'family'; id: string; blocks: AnyBlock[] };

const ROLE_ORDER = { analysis: 0, encoder: 1, decoder: 2 } as const;

/** Biblioteca de bloques en carpetas plegables, agrupados por familia. */
export function Palette() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<BlockCategory>>(() => {
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      if (raw) return new Set(JSON.parse(raw) as BlockCategory[]);
    } catch {
      /* sin almacenamiento */
    }
    return new Set(DEFAULT_OPEN);
  });
  const addBlock = useStore((s) => s.addBlock);
  const { screenToFlowPosition } = useReactFlow();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (b: AnyBlock) => {
      if (!q) return true;
      const tx = blockText(b.id);
      const fam = b.family ? t(`families.${b.family}`) : '';
      return `${tx.title} ${tx.summary} ${fam} ${(tx.concepts ?? []).join(' ')}`
        .toLowerCase()
        .includes(q);
    };
    return categoryOrder
      .map((cat) => {
        const blocks = registry.list().filter((b) => b.category === cat && !b.hidden && matches(b));
        const entries: Entry[] = [];
        const families = new Map<string, AnyBlock[]>();
        for (const b of blocks) {
          if (!b.family) entries.push({ kind: 'single', block: b });
          else if (families.has(b.family)) families.get(b.family)!.push(b);
          else {
            const list = [b];
            families.set(b.family, list);
            entries.push({ kind: 'family', id: b.family, blocks: list });
          }
        }
        for (const e of entries) {
          if (e.kind === 'family') {
            e.blocks.sort(
              (a, b) =>
                ROLE_ORDER[a.familyRole ?? 'encoder'] - ROLE_ORDER[b.familyRole ?? 'encoder'],
            );
          }
        }
        entries.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b), 'es'));
        return { cat, entries, count: blocks.length };
      })
      .filter((g) => g.count);
  }, [query]);

  function toggle(cat: BlockCategory) {
    const next = new Set(open);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      /* sin almacenamiento */
    }
  }

  /** Dónde poner un bloque añadido con clic: a la derecha del seleccionado o de todo. */
  function nextPosition(): { position: XYPosition; anchorId?: string } {
    const { nodes, selection } = useStore.getState();
    const anchor =
      selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) : undefined;
    if (anchor)
      return {
        position: { x: anchor.position.x + 320, y: anchor.position.y },
        anchorId: anchor.id,
      };
    if (nodes.length) {
      const right = nodes.reduce((a, b) => (b.position.x > a.position.x ? b : a));
      return { position: { x: right.position.x + 320, y: right.position.y } };
    }
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    return {
      position: screenToFlowPosition({
        x: canvas.left + canvas.width / 2 - 120,
        y: canvas.top + canvas.height / 2 - 100,
      }),
    };
  }

  /**
   * Clic en la paleta: el bloque nuevo va detrás del seleccionado y se conecta
   * a él si los tipos encajan. Así se monta una cadena solo con clics.
   */
  function addByClick(...types: string[]) {
    for (const type of types) {
      const { position, anchorId } = nextPosition();
      const id = addBlock(type, position);
      if (anchorId) connect(anchorId, id);
    }
  }

  const q = query.trim();
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
      {groups.length === 0 && <p className="hint">{t('palette.noResults', { q })}</p>}
      {groups.map(({ cat, entries, count }) => {
        const isOpen = !!q || open.has(cat);
        return (
          <section
            key={cat}
            className={`folder${isOpen ? ' is-open' : ''}`}
            style={{ '--cat': categoryColor[cat] } as CSSProperties}
          >
            <button className="folder-head" aria-expanded={isOpen} onClick={() => toggle(cat)}>
              <svg
                className="folder-chevron"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden
              >
                <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span className="folder-dot" aria-hidden />
              <span className="folder-name">
                {t(`categories.${cat}`)}
                <small>{t(`categoryHints.${cat}`)}</small>
              </span>
              <span className="folder-count">{count}</span>
            </button>
            {isOpen && (
              <ul className="folder-items">
                {entries.map((e) =>
                  e.kind === 'single' ? (
                    <li key={e.block.id}>
                      <BlockItem block={e.block} onAdd={() => addByClick(e.block.id)} />
                    </li>
                  ) : (
                    <li key={e.id}>
                      <FamilyItem
                        family={e.id}
                        blocks={e.blocks}
                        onAdd={(id) => addByClick(id)}
                        onAddAll={() => addByClick(...e.blocks.map((b) => b.id))}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}

function roleLabel(family: string, role: string): string {
  const specific = t(`familyRoleLabels.${family}.${role}`);
  return specific.startsWith('familyRoleLabels.') ? t(`familyRoles.${role}`) : specific;
}

function entryTitle(e: Entry): string {
  return e.kind === 'single' ? blockText(e.block.id).title : t(`families.${e.id}`);
}

function onDragStart(e: DragEvent, type: string) {
  e.dataTransfer.setData(DRAG_MIME, type);
  e.dataTransfer.effectAllowed = 'move';
}

function BlockItem({ block, onAdd }: { block: AnyBlock; onAdd(): void }) {
  const tx = blockText(block.id);
  return (
    <button
      className="palette-item"
      draggable
      onDragStart={(e) => onDragStart(e, block.id)}
      onClick={onAdd}
    >
      <BlockGlyph category={block.category} size={26} />
      <span className="palette-text">
        <strong>{tx.title}</strong>
        <small>{tx.summary}</small>
      </span>
    </button>
  );
}

/** Tarjeta de una familia: el título añade toda la cadena; cada pastilla, un bloque. */
function FamilyItem({
  family,
  blocks,
  onAdd,
  onAddAll,
}: {
  family: string;
  blocks: AnyBlock[];
  onAdd(id: string): void;
  onAddAll(): void;
}) {
  const main = blocks.find((b) => b.familyRole === 'encoder') ?? blocks[0];
  const tx = blockText(main.id);
  return (
    <div className="palette-family">
      <button className="palette-item" onClick={onAddAll} title="Añadir la pareja ya conectada">
        <BlockGlyph category={main.category} size={26} />
        <span className="palette-text">
          <strong>{t(`families.${family}`)}</strong>
          <small>{tx.summary}</small>
        </span>
      </button>
      <div className="family-parts">
        {blocks.map((b) => (
          <button
            key={b.id}
            className="family-part"
            draggable
            onDragStart={(e) => onDragStart(e, b.id)}
            onClick={() => onAdd(b.id)}
            title={blockText(b.id).summary}
          >
            {roleLabel(family, b.familyRole ?? 'encoder')}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Conecta la primera salida compatible de `fromId` con la primera entrada obligatoria de `toId`. */
function connect(fromId: string, toId: string) {
  const { nodes, onConnect } = useStore.getState();
  const from = registry.get(nodes.find((n) => n.id === fromId)!.data.blockType)!;
  const to = registry.get(nodes.find((n) => n.id === toId)!.data.blockType)!;
  const inPort = Object.entries(to.inputs).find(([, s]) => !s.optional)?.[0];
  const outPort =
    inPort && Object.entries(from.outputs).find(([, s]) => s.type === to.inputs[inPort].type)?.[0];
  if (inPort && outPort)
    onConnect({ source: fromId, sourceHandle: outPort, target: toId, targetHandle: inPort });
}

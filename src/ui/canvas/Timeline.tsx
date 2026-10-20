import { useRef, type PointerEvent } from 'react';
import { t } from '@/i18n';
import { formatNumber } from '../lib/format';
import { Envelope } from '../plots/Envelope';
import { registry } from '../registry';
import { useStore } from '../store';

const W = 520;
const H = 40;

/**
 * Lupa temporal: la onda de la entrada principal con un cursor. El instante
 * elegido se usa en todos los bloques (miniaturas y panel lateral).
 */
export function Timeline() {
  const cursor = useStore((s) => s.cursor);
  const setCursor = useStore((s) => s.setCursor);
  const source = useStore((s) => {
    const n = s.nodes.find((x) => registry.get(x.data.blockType)?.category === 'entrada' && s.results?.nodes[x.id]?.status === 'ok');
    const out = n && s.results?.nodes[n.id]?.outputs.out?.summary;
    return out?.kind === 'signal' ? out : undefined;
  });
  const raf = useRef(0);
  if (!source) return null;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setCursor(x * source.durationS));
  };

  return (
    <div className={`timeline${cursor !== null ? ' is-on' : ''}`}>
      <div className="timeline-head">
        <strong>{t('timeline.label')}</strong>
        <span>
          {cursor === null ? t('timeline.hint') : t('timeline.at', { t: formatNumber(cursor, 3) })}
        </span>
        {cursor !== null && (
          <button className="btn btn-quiet" onClick={() => setCursor(null)}>
            {t('timeline.off')}
          </button>
        )}
      </div>
      <div
        className="timeline-track nodrag"
        role="slider"
        aria-label={t('timeline.label')}
        aria-valuemin={0}
        aria-valuemax={source.durationS}
        aria-valuenow={cursor ?? 0}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
        onKeyDown={(e) => {
          const step = source.durationS / 100;
          if (e.key === 'ArrowRight') setCursor(Math.min(source.durationS, (cursor ?? 0) + step));
          if (e.key === 'ArrowLeft') setCursor(Math.max(0, (cursor ?? 0) - step));
          if (e.key === 'Escape') setCursor(null);
        }}
      >
        <Envelope env={source.preview} width={W} height={H} color="var(--ink-3)" />
        {cursor !== null && <i className="timeline-cursor" style={{ left: `${(cursor / source.durationS) * 100}%` }} />}
      </div>
    </div>
  );
}

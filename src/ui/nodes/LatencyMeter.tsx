import { t } from '@/i18n';
import { formatMetric } from '../lib/format';

/** Barra de retardo extremo a extremo frente a los límites de una conversación (ITU-T G.114). */
export function LatencyMeter({ ms }: { ms: number }) {
  const max = 400;
  const level = ms < 150 ? 'ok' : ms < 400 ? 'warn' : 'bad';
  return (
    <div className={`latency latency-${level}`} title={t('latency.explain')}>
      <div className="latency-head">
        <span>{t('latency.total')}</span>
        <strong>{formatMetric(ms, 'ms').value} ms</strong>
      </div>
      <div className="latency-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={ms}>
        <span style={{ width: `${Math.min(100, (ms / max) * 100)}%` }} />
        <i style={{ left: `${(150 / max) * 100}%` }} />
      </div>
      <small>{t(`latency.${level}`)}</small>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { blockText } from '@/i18n';
import { BENCH_FAMILIES, type BenchPoint } from '@/runtime/benchConfigs';
import { engine } from '@/runtime/client';
import { onPlaybackChange, play, stop } from '../lib/audio';
import { formatNumber } from '../lib/format';
import { useStore } from '../store';

/** Color fijo por familia (orden fijo de la paleta categórica validada). */
const SERIES = ['#2563D9', '#C98A00', '#16895C', '#BE2459', '#0B7F8C', '#566273', '#9A4777'];
const colorOf = (familyId: string) =>
  SERIES[BENCH_FAMILIES.findIndex((f) => f.id === familyId) % SERIES.length];

type Metric = 'snrSeg' | 'snr' | 'lsd';
const METRICS: Record<
  Metric,
  { label: string; unit: string; better: 'higher' | 'lower'; help: string }
> = {
  snrSeg: {
    label: 'SNR segmental',
    unit: 'dB',
    better: 'higher',
    help: 'Parecido de la forma de onda, trama a trama (cada trama cuenta como mucho 35 dB, por eso las curvas se aplanan arriba). Más es mejor.',
  },
  snr: {
    label: 'SNR global',
    unit: 'dB',
    better: 'higher',
    help: 'Parecido de la forma de onda en todo el audio. Más es mejor.',
  },
  lsd: {
    label: 'Distancia espectral',
    unit: 'dB',
    better: 'lower',
    help: 'Diferencia entre espectros, sin mirar la fase: no castiga a vocoders ni perceptuales. Menos es mejor.',
  },
};

/**
 * Comparador tasa–calidad: la misma señal por varios códecs, barriendo un
 * ajuste de cada uno, y una curva de kbps frente a calidad.
 */
export function BenchPanel() {
  const open = useStore((s) => s.bench);
  const nodes = useStore((s) => s.nodes);
  const results = useStore((s) => s.results);
  const [sourceId, setSourceId] = useState('');
  const [rate, setRate] = useState(16000);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['pcm-mu', 'dpcm', 'subband', 'celp', 'lpc']),
  );
  const [metric, setMetric] = useState<Metric>('snrSeg');
  const [points, setPoints] = useState<BenchPoint[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => onPlaybackChange(setPlaying), []);

  // Señales disponibles: salidas de audio de las fuentes del circuito.
  const sources = useMemo(
    () =>
      nodes
        .filter((n) => results?.nodes[n.id]?.outputs.out?.summary.kind === 'signal')
        .map((n) => ({ id: n.id, title: blockText(n.data.blockType).title })),
    [nodes, results],
  );
  const source = sources.find((s) => s.id === sourceId) ?? sources[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useStore.setState({ bench: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  async function run() {
    if (!source) return;
    const ok = await engine.benchSource(source.id, 'out', rate);
    if (!ok) return;
    const jobs = BENCH_FAMILIES.filter((f) => selected.has(f.id)).flatMap((f) =>
      f.sweep.values.map((v) => [f, v] as const),
    );
    setPoints([]);
    setProgress({ done: 0, total: jobs.length });
    const acc: BenchPoint[] = [];
    for (const [f, v] of jobs) {
      const p = await engine.benchPoint(f.id, v);
      acc.push(p);
      setPoints([...acc]);
      setProgress({ done: acc.length, total: jobs.length });
    }
    setProgress(null);
  }

  async function listen(key: string) {
    if (playing === `bench:${key}`) return stop();
    const s = await engine.benchSignal(key);
    if (s) play(s, `bench:${key}`);
  }

  const valid = points.filter((p) => !p.error && Number.isFinite(p[metric]));
  const failed = points.filter((p) => p.error);

  return (
    <div
      className="theory-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && useStore.setState({ bench: false })}
    >
      <div className="bench" role="dialog" aria-modal="true" aria-label="Comparar códecs">
        <header className="bench-head">
          <div>
            <h2>Comparar códecs</h2>
            <p>
              La misma señal pasa por cada códec con varios ajustes. Cada punto es una pareja
              codificador + decodificador: cuántos kbps gasta y cuánto se parece el resultado al
              original.
            </p>
          </div>
          <button className="btn btn-quiet" onClick={() => useStore.setState({ bench: false })}>
            Cerrar
          </button>
        </header>

        <div className="bench-controls">
          <label>
            Señal
            <select value={source?.id ?? ''} onChange={(e) => setSourceId(e.target.value)}>
              {sources.length === 0 && <option value="">Añade una fuente al circuito</option>}
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frecuencia de muestreo
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              <option value={8000}>8 kHz (voz telefónica)</option>
              <option value={16000}>16 kHz (voz de banda ancha)</option>
              <option value={32000}>32 kHz (música)</option>
            </select>
          </label>
          <label>
            Calidad medida con
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {Object.entries(METRICS).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={!source || !!progress || selected.size === 0}
          >
            {progress ? `Calculando ${progress.done} de ${progress.total}…` : 'Comparar'}
          </button>
        </div>

        <fieldset className="bench-families">
          <legend>Códecs</legend>
          {BENCH_FAMILIES.map((f) => (
            <label key={f.id} className="bench-family">
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(f.id);
                  else next.delete(f.id);
                  setSelected(next);
                }}
              />
              <i style={{ background: colorOf(f.id) }} aria-hidden />
              {f.title}
              <small>{f.kind === 'voz' ? 'para voz' : ''}</small>
            </label>
          ))}
        </fieldset>

        <p className="param-help">{METRICS[metric].help}</p>
        {valid.length > 0 ? (
          <RateQualityChart
            points={valid}
            metric={metric}
            onPick={(p) => listen(`${p.family}:${String(p.value)}`)}
          />
        ) : (
          <div className="bench-empty">
            {progress
              ? 'Calculando los primeros puntos…'
              : 'Elige la señal y los códecs y pulsa «Comparar».'}
          </div>
        )}

        {points.length > 0 && (
          <table className="bench-table">
            <thead>
              <tr>
                <th>Códec</th>
                <th>Ajuste</th>
                <th>kbps</th>
                <th>{METRICS[metric].label}</th>
                <th>
                  <span className="sr-only">Escuchar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4}>Original (para comparar de oído)</td>
                <td>
                  <button className="btn btn-quiet" onClick={() => listen('ref')}>
                    {playing === 'bench:ref' ? 'Parar' : 'Escuchar'}
                  </button>
                </td>
              </tr>
              {points.map((p) => {
                const f = BENCH_FAMILIES.find((x) => x.id === p.family)!;
                const key = `${p.family}:${String(p.value)}`;
                return (
                  <tr key={key}>
                    <td>
                      <i className="swatch" style={{ background: colorOf(p.family) }} aria-hidden />{' '}
                      {f.title}
                    </td>
                    <td>{f.sweep.label(p.value)}</td>
                    <td className="num">{p.error ? '—' : formatNumber(p.bitrate / 1000, 1)}</td>
                    <td className="num">
                      {p.error ? p.error : `${formatNumber(p[metric], 1)} ${METRICS[metric].unit}`}
                    </td>
                    <td>
                      {!p.error && (
                        <button className="btn btn-quiet" onClick={() => listen(key)}>
                          {playing === `bench:${key}` ? 'Parar' : 'Escuchar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {failed.length > 0 && (
          <p className="param-help">
            Algunos ajustes no se pueden usar con esta frecuencia de muestreo (por ejemplo, MPEG-1 a
            muy baja tasa).
          </p>
        )}
      </div>
    </div>
  );
}

const W = 760;
const H = 340;
const M = { top: 16, right: 120, bottom: 40, left: 52 };

/** Curvas tasa–calidad: kbps en escala logarítmica, una línea por códec. */
function RateQualityChart({
  points,
  metric,
  onPick,
}: {
  points: BenchPoint[];
  metric: Metric;
  onPick(p: BenchPoint): void;
}) {
  const [hover, setHover] = useState<BenchPoint | null>(null);
  const kbps = points.map((p) => p.bitrate / 1000);
  const xMin = Math.max(0.5, Math.min(...kbps) / 1.4);
  const xMax = Math.max(...kbps) * 1.4;
  const vals = points.map((p) => p[metric]);
  let yMin = Math.min(...vals);
  let yMax = Math.max(...vals);
  const pad = Math.max(2, (yMax - yMin) * 0.08);
  yMin = Math.floor((yMin - pad) / 5) * 5;
  yMax = Math.ceil((yMax + pad) / 5) * 5;
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const sx = (k: number) =>
    M.left + ((Math.log(k) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) * iw;
  const sy = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const xTicks = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024].filter(
    (t) => t >= xMin && t <= xMax,
  );
  const yStep = (yMax - yMin) / 5 > 10 ? 10 : 5;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) yTicks.push(v);

  const byFamily = BENCH_FAMILIES.map((f) => ({
    f,
    pts: points.filter((p) => p.family === f.id).sort((a, b) => a.bitrate - b.bitrate),
  })).filter((g) => g.pts.length);
  // Etiquetas directas al final de cada línea, separadas para que no se pisen.
  const labels = byFamily
    .map(({ f, pts }) => ({
      f,
      y: sy(pts[pts.length - 1][metric]),
      x: sx(pts[pts.length - 1].bitrate / 1000),
    }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 14);

  return (
    <figure className="rq-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Calidad (${METRICS[metric].label}) frente a tasa binaria`}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={sy(v)} y2={sy(v)} className="rq-grid" />
            <text x={M.left - 8} y={sy(v) + 4} textAnchor="end" className="rq-tick">
              {formatNumber(v, 0)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={H - M.bottom} className="rq-grid" />
            <text x={sx(t)} y={H - M.bottom + 16} textAnchor="middle" className="rq-tick">
              {formatNumber(t, 1)}
            </text>
          </g>
        ))}
        <text x={M.left + iw / 2} y={H - 4} textAnchor="middle" className="rq-axis">
          Tasa binaria (kbps, escala logarítmica)
        </text>
        <text
          x={14}
          y={M.top + ih / 2}
          textAnchor="middle"
          className="rq-axis"
          transform={`rotate(-90 14 ${M.top + ih / 2})`}
        >
          {METRICS[metric].label} ({METRICS[metric].unit})
          {METRICS[metric].better === 'lower' ? ', menos es mejor' : ''}
        </text>
        {byFamily.map(({ f, pts }) => (
          <g key={f.id}>
            <polyline
              points={pts.map((p) => `${sx(p.bitrate / 1000)},${sy(p[metric])}`).join(' ')}
              fill="none"
              stroke={colorOf(f.id)}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {pts.map((p) => (
              <g key={String(p.value)}>
                <circle
                  cx={sx(p.bitrate / 1000)}
                  cy={sy(p[metric])}
                  r={4.5}
                  fill={colorOf(f.id)}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <circle
                  cx={sx(p.bitrate / 1000)}
                  cy={sy(p[metric])}
                  r={12}
                  fill="transparent"
                  className="rq-hit"
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPick(p)}
                />
              </g>
            ))}
          </g>
        ))}
        {labels.map(({ f, x, y }) => (
          <text key={f.id} x={Math.min(x + 10, W - M.right + 8)} y={y + 4} className="rq-label">
            {f.title}
          </text>
        ))}
        {hover && (
          <g
            transform={`translate(${Math.min(sx(hover.bitrate / 1000) + 12, W - 190)} ${Math.max(sy(hover[metric]) - 48, 4)})`}
            pointerEvents="none"
          >
            <rect width={180} height={52} rx={8} className="rq-tip" />
            <text x={10} y={18} className="rq-tip-title">
              {BENCH_FAMILIES.find((f) => f.id === hover.family)?.title},{' '}
              {BENCH_FAMILIES.find((f) => f.id === hover.family)?.sweep.label(hover.value)}
            </text>
            <text x={10} y={36} className="rq-tip-text">
              {formatNumber(hover.bitrate / 1000, 1)} kbps, {formatNumber(hover[metric], 1)}{' '}
              {METRICS[metric].unit}
            </text>
            <text x={10} y={48} className="rq-tip-hint">
              Clic para escuchar
            </text>
          </g>
        )}
      </svg>
      <figcaption className="plot-legend">
        {byFamily.map(({ f }) => (
          <span key={f.id}>
            <i style={{ background: colorOf(f.id) }} />
            {f.title}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { LineSeries, Plot as PlotData, PlotRole } from '@/engine/types';
import { t } from '@/i18n';
import { errorSeriesColor, inputSeriesColor } from '../theme';
import { RichInline, RichText } from '../text/RichText';

interface Props {
  plot: PlotData;
  /** Color de la salida (el de la categoría del bloque). */
  color: string;
  width: number;
  height: number;
  /** Con leyenda y etiquetas de ejes (en el inspector). */
  detailed?: boolean;
}

const roleColor = (role: PlotRole, color: string) =>
  role === 'in'
    ? inputSeriesColor
    : role === 'error'
      ? errorSeriesColor
      : role === 'aux'
        ? '#C3C9D2'
        : color;

/**
 * Gráficas didácticas en SVG: sin rejillas ni cifras en los ejes. Lo
 * importante es ver la forma y comparar entrada (gris) con salida (color).
 */
export const Plot = memo(function Plot({ plot, color, width, height, detailed }: Props) {
  if (plot.kind === 'image') return <ImageView image={plot} width={width} height={height} />;
  if (plot.kind === 'text') return <pre className="plot-text">{plot.text}</pre>;
  if (plot.kind === 'table') return <TablePlot plot={plot} detailed={detailed} />;
  return plot.kind === 'line' ? (
    <LinePlot plot={plot} color={color} width={width} height={height} detailed={detailed} />
  ) : (
    <BarsPlot plot={plot} color={color} width={width} height={height} />
  );
});

/**
 * Imagen RGBA en un canvas. Cabe en `width` de ancho; de alto se permite
 * algo más que una gráfica (mín. 120 px), porque una imagen aplastada no se ve.
 */
export function ImageView({
  image,
  width,
  height,
}: {
  image: { width: number; height: number; rgba: Uint8ClampedArray };
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !image.width || !image.height) return;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
      0,
      0,
    );
  }, [image]);
  const maxH = Math.max(height, 120);
  const s = Math.min(width / image.width, maxH / image.height);
  return (
    <canvas
      ref={ref}
      className="plot-image"
      width={image.width}
      height={image.height}
      style={{ width: image.width * s, height: image.height * s }}
    />
  );
}

function LinePlot({
  plot,
  color,
  width,
  height,
  detailed,
}: Omit<Props, 'plot'> & { plot: Extract<PlotData, { kind: 'line' }> }) {
  // Con marcas de ejes se reserva sitio a la izquierda (dB) y abajo (frecuencia).
  const axes = detailed && !!(plot.xTicks || plot.yTicks);
  const pad = detailed ? 6 : 3;
  const m = axes
    ? { l: plot.yTicks ? 46 : pad, r: 10, t: 6, b: plot.xTicks ? 20 : pad }
    : { l: pad, r: pad, t: pad, b: pad };
  const geometry = useMemo(() => {
    let yMin = Infinity;
    let yMax = -Infinity;
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const s of plot.series) {
      for (let i = 0; i < s.y.length; i++) {
        if (!Number.isFinite(s.y[i])) continue;
        yMin = Math.min(yMin, s.y[i]);
        yMax = Math.max(yMax, s.y[i]);
      }
      if (s.x)
        for (let i = 0; i < s.x.length; i++) {
          xMin = Math.min(xMin, s.x[i]);
          xMax = Math.max(xMax, s.x[i]);
        }
    }
    if (plot.yRange) [yMin, yMax] = plot.yRange;
    if (plot.xRange) [xMin, xMax] = plot.xRange;
    if (!Number.isFinite(yMin) || yMin === yMax) {
      yMin = (Number.isFinite(yMin) ? yMin : 0) - 1;
      yMax = yMin + 2;
    }
    const iw = width - m.l - m.r;
    const ih = height - m.t - m.b;
    const fx = (v: number) => m.l + ((v - xMin) / (xMax - xMin)) * iw;
    const sx = (s: LineSeries, i: number) =>
      s.x && xMax > xMin ? fx(s.x[i]) : m.l + (i / Math.max(1, s.y.length - 1)) * iw;
    const sy = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
    const zeroY = !axes && yMin < 0 && yMax > 0 ? sy(0) : null;

    const paths = plot.series.map((s) => {
      let d = '';
      for (let i = 0; i < s.y.length; i++) {
        const x = sx(s, i);
        const y = sy(Math.min(yMax, Math.max(yMin, s.y[i])));
        if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
        else if (s.style === 'step') d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
        else d += `L${x.toFixed(1)},${y.toFixed(1)}`;
      }
      return { d, s };
    });
    return { paths, zeroY, sx, sy, fx };
  }, [plot, width, height, m.l, m.r, m.t, m.b, axes]);

  const roles = [...new Set(plot.series.map((s) => s.role))];

  return (
    <figure className="plot">
      <svg width={width} height={height} role="img" aria-label={plot.title}>
        {axes &&
          plot.yTicks?.map((tk, i) => (
            <g key={`y${tk.value}`}>
              <line
                x1={m.l}
                x2={width - m.r}
                y1={geometry.sy(tk.value)}
                y2={geometry.sy(tk.value)}
                className={i === 0 ? 'plot-base' : 'plot-grid'}
              />
              <text x={m.l - 6} y={geometry.sy(tk.value) + 4} textAnchor="end" className="tick">
                {tk.label}
              </text>
            </g>
          ))}
        {axes &&
          plot.xTicks?.map((tk, i, all) => (
            <text
              key={`x${tk.value}`}
              x={geometry.fx(tk.value)}
              y={height - 5}
              textAnchor={i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle'}
              className="tick"
            >
              {tk.label}
            </text>
          ))}
        {geometry.zeroY !== null && (
          <line x1={0} x2={width} y1={geometry.zeroY} y2={geometry.zeroY} className="plot-zero" />
        )}
        {geometry.paths.map(({ d, s }, i) =>
          s.style === 'dots' ? (
            <g key={i} fill={roleColor(s.role, color)}>
              {Array.from(s.y, (v, j) =>
                Number.isFinite(v) ? (
                  <circle key={j} cx={geometry.sx(s, j)} cy={geometry.sy(v)} r={1.8} />
                ) : null,
              )}
            </g>
          ) : (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={roleColor(s.role, color)}
              strokeWidth={s.role === 'in' ? (axes ? 2.5 : 3.5) : s.role === 'aux' ? 1 : 1.5}
              strokeOpacity={s.role === 'in' ? 0.75 : 1}
              strokeLinejoin="round"
              strokeDasharray={s.role === 'aux' ? '3 3' : undefined}
            />
          ),
        )}
      </svg>
      {detailed && (
        <figcaption className="plot-legend">
          {roles.map((r) => (
            <span key={r}>
              <i style={{ background: roleColor(r, color) }} />
              {t(`plotRoles.${r}`)}
            </span>
          ))}
          {!axes && (plot.xLabel || plot.yLabel) && (
            <span className="plot-axes">
              {plot.yLabel} frente a {plot.xLabel}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function BarsPlot({
  plot,
  color,
  width,
  height,
}: Omit<Props, 'plot' | 'detailed'> & { plot: Extract<PlotData, { kind: 'bars' }> }) {
  const max = Math.max(1e-12, ...plot.values.map(Math.abs));
  const bw = width / Math.max(1, plot.values.length);
  const hl = new Set(plot.highlight ?? []);
  return (
    <figure className="plot">
      <svg width={width} height={height} role="img" aria-label={plot.title}>
        {plot.values.map((v, i) => {
          const h = (Math.abs(v) / max) * (height - 4);
          return (
            <rect
              key={i}
              x={i * bw + bw * 0.12}
              y={height - h}
              width={Math.max(1, bw * 0.76)}
              height={h}
              rx={Math.min(2, bw / 4)}
              fill={hl.size === 0 || hl.has(i) ? color : inputSeriesColor}
            >
              {plot.labels?.[i] && <title>{plot.labels[i]}</title>}
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

type TableData = Extract<PlotData, { kind: 'table' }>;

/**
 * Tabla paso a paso. En el nodo se ven solo las primeras filas; en el
 * panel, entera o fila a fila (si el bloque la marca `stepwise`), y se
 * puede ampliar para verla con calma.
 */
function TablePlot({ plot, detailed }: { plot: TableData; detailed?: boolean }) {
  const [shown, setShown] = useState<number | null>(null);
  const [big, setBig] = useState(false);
  if (!detailed) return <TableGrid plot={plot} rows={3} mini />;
  const stepping = plot.stepwise && shown !== null;
  return (
    <div className="plot-table">
      <TableGrid plot={plot} rows={stepping ? shown : undefined} />
      <div className="plot-table-actions">
        {plot.stepwise &&
          (shown === null ? (
            <button type="button" className="btn btn-small" onClick={() => setShown(1)}>
              Paso a paso
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-small btn-primary"
                disabled={shown >= plot.rows.length}
                onClick={() => setShown(shown + 1)}
              >
                Siguiente fila
              </button>
              <button type="button" className="btn btn-small" onClick={() => setShown(null)}>
                Ver todo
              </button>
            </>
          ))}
        <button type="button" className="btn btn-small btn-quiet" onClick={() => setBig(true)}>
          Ampliar
        </button>
      </div>
      {big && (
        <div
          className="table-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setBig(false)}
          onKeyDown={(e) => e.key === 'Escape' && setBig(false)}
        >
          <div className="table-dialog" role="dialog" aria-modal="true" aria-label={plot.title}>
            <header>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setBig(false)}
                autoFocus
              >
                Cerrar
              </button>
            </header>
            <TableGrid plot={plot} rows={stepping ? shown : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

/** La rejilla de la tabla; `rows` limita cuántas filas se ven. */
export function TableGrid({
  plot,
  rows,
  mini,
}: {
  plot: Pick<TableData, 'columns' | 'rows' | 'notes' | 'highlight'>;
  rows?: number;
  mini?: boolean;
}) {
  const hl = new Set(plot.highlight ?? []);
  const visible = rows === undefined ? plot.rows : plot.rows.slice(0, rows);
  return (
    <>
      <div className={`table-wrap${mini ? ' is-mini' : ''}`}>
        <table className="trace-table">
          <thead>
            <tr>
              {plot.columns.map((c, i) => (
                <th key={i} scope="col">
                  <RichInline text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className={hl.has(i) ? 'is-highlight' : undefined}>
                {r.map((v, j) => (
                  <td key={j} className={typeof v === 'number' ? 'num' : undefined}>
                    {typeof v === 'number' ? formatCell(v) : <RichInline text={v} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mini && plot.rows.length > visible.length && (
        <p className="table-more">… {plot.rows.length - visible.length} filas más</p>
      )}
      {!mini &&
        (rows === undefined || rows >= plot.rows.length) &&
        plot.notes?.map((n, i) => <RichText key={i} text={n} className="table-note" />)}
    </>
  );
}

/** Números de tabla: enteros tal cual; decimales con coma y sin ceros de más. */
function formatCell(v: number): string {
  if (Number.isInteger(v)) return String(v).replace('-', '−');
  return Number(v.toFixed(4)).toString().replace('.', ',').replace('-', '−');
}

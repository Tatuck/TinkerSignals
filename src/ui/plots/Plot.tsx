import { memo, useMemo } from 'react';
import type { LineSeries, Plot as PlotData, PlotRole } from '@/engine/types';
import { t } from '@/i18n';
import { errorSeriesColor, inputSeriesColor } from '../theme';

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
  return plot.kind === 'line' ? (
    <LinePlot plot={plot} color={color} width={width} height={height} detailed={detailed} />
  ) : (
    <BarsPlot plot={plot} color={color} width={width} height={height} />
  );
});

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

import { memo, useEffect, useRef } from 'react';
import { formatRate } from '../lib/format';

/** Espectro medio en dB, de 0 a fs/2, con las frecuencias de referencia justas. */
export const Spectrum = memo(function Spectrum({
  db,
  sampleRate,
  width,
  height,
  color,
}: {
  db: Float32Array;
  sampleRate: number;
  width: number;
  height: number;
  color: string;
}) {
  const floor = -90;
  let top = -Infinity;
  for (const v of db) top = Math.max(top, v);
  top = Math.max(top, floor + 20);
  const y = (v: number) => 2 + (1 - (Math.max(floor, v) - floor) / (top - floor)) * (height - 18);
  let d = `M0,${height - 16}`;
  for (let k = 0; k < db.length; k++) d += `L${((k / (db.length - 1)) * width).toFixed(1)},${y(db[k]).toFixed(1)}`;
  d += `L${width},${height - 16}Z`;
  return (
    <svg width={width} height={height} className="spectrum" aria-hidden>
      <path d={d} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.4} />
      <text x={0} y={height - 3} className="axis-label">0 Hz</text>
      <text x={width / 2} y={height - 3} className="axis-label" textAnchor="middle">
        {formatRate(sampleRate / 4)}
      </text>
      <text x={width} y={height - 3} className="axis-label" textAnchor="end">
        {formatRate(sampleRate / 2)}
      </text>
    </svg>
  );
});

/** Espectrograma en canvas: tiempo en horizontal, frecuencia en vertical. */
export const Spectrogram = memo(function Spectrogram({
  cols,
  width,
  height,
}: {
  cols: Float32Array[];
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !cols.length) return;
    const ctx = c.getContext('2d')!;
    const bins = cols[0].length;
    const img = ctx.createImageData(cols.length, bins);
    let top = -Infinity;
    for (const col of cols) for (const v of col) top = Math.max(top, v);
    const floor = top - 70;
    for (let x = 0; x < cols.length; x++) {
      for (let k = 0; k < bins; k++) {
        const v = Math.max(0, Math.min(1, (cols[x][k] - floor) / (top - floor)));
        const [r, g, b] = ramp(v);
        const i = ((bins - 1 - k) * cols.length + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    c.width = cols.length;
    c.height = bins;
    ctx.putImageData(img, 0, 0);
  }, [cols]);
  return <canvas ref={ref} style={{ width, height }} className="spectrogram" aria-hidden />;
});

/** Paleta papel → tinta azul → ámbar: legible sobre fondo claro. */
function ramp(v: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0, 246, 248, 251],
    [0.45, 120, 150, 235],
    [0.75, 47, 60, 160],
    [1, 240, 170, 20],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ...ca] = stops[i - 1];
      const [b, ...cb] = stops[i];
      const f = (v - a) / (b - a);
      return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * f)) as [number, number, number];
    }
  }
  return [240, 170, 20];
}

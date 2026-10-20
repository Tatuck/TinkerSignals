import { memo } from 'react';

/** Miniatura min/max de una señal entera. */
export const Envelope = memo(function Envelope({
  env,
  width,
  height,
  color,
}: {
  env: { min: Float32Array; max: Float32Array };
  width: number;
  height: number;
  color: string;
}) {
  const n = env.min.length;
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(env.min[i]), Math.abs(env.max[i]));
  const scale = Math.max(peak, 0.05); // no amplificar el silencio hasta parecer ruido
  const y = (v: number) => height / 2 - (v / scale) * (height / 2 - 1);
  let top = '';
  let bottom = '';
  for (let i = 0; i < n; i++) {
    const x = (i / Math.max(1, n - 1)) * width;
    top += `${i ? 'L' : 'M'}${x.toFixed(1)},${y(env.max[i]).toFixed(1)}`;
    bottom = `L${x.toFixed(1)},${y(env.min[i]).toFixed(1)}` + bottom;
  }
  return (
    <svg width={width} height={height} className="envelope" aria-hidden>
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="plot-zero" />
      <path d={top + bottom + 'Z'} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={0.6} />
    </svg>
  );
});

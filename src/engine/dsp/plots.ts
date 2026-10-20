import type { Plot } from '../types';
import { interestingWindow } from './signal';

/**
 * Gráfica estándar "entrada vs salida": un trozo corto de la zona con más
 * energía, con las dos señales superpuestas. Es la gráfica por defecto de
 * casi todos los bloques que transforman una señal.
 */
export function compareWaves(
  input: Float32Array,
  output: Float32Array,
  sampleRate: number,
  opts: { ms?: number; outStyle?: 'line' | 'step' | 'dots'; title?: string; withError?: boolean } = {},
): Plot {
  const len = Math.max(16, Math.round(((opts.ms ?? 6) / 1000) * sampleRate));
  const win = interestingWindow(input, len);
  const a = input.slice(win[0], win[1]);
  const b = output.slice(win[0], win[1]);
  const series: Extract<Plot, { kind: 'line' }>['series'] = [
    { role: 'in', y: a },
    { role: 'out', y: b, style: opts.outStyle ?? 'line' },
  ];
  if (opts.withError) {
    const e = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) e[i] = a[i] - b[i];
    series.push({ role: 'error', y: e });
  }
  return { kind: 'line', title: opts.title ?? 'wave', series };
}

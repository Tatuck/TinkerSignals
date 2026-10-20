import { frameSpectrumDb } from './dsp/voice';
import type { Frames, Plot, PortValue, Signal } from './types';

/**
 * Lupa temporal: gráficas de lo que pasa en un instante concreto. Todas se
 * calculan a partir de los valores que ya han pasado por los cables, así que
 * valen para cualquier bloque sin que tenga que saber nada de la lupa.
 */

/** Trozo de `ms` milisegundos centrado en `timeS`. */
export function windowAt(s: Signal, timeS: number, ms: number): Float32Array {
  const n = Math.max(8, Math.round((ms / 1000) * s.sampleRate));
  const center = Math.round(timeS * s.sampleRate);
  const start = Math.max(0, Math.min(s.samples.length - n, center - Math.floor(n / 2)));
  return s.samples.slice(Math.max(0, start), Math.max(0, start) + n);
}

/** Trama que contiene el instante `timeS`. */
export function frameAt(f: Frames, timeS: number): { frame: Float32Array; index: number } {
  const index = Math.max(
    0,
    Math.min(f.data.length - 1, Math.floor((timeS * f.sampleRate) / f.hop)),
  );
  return { frame: f.data[index] ?? new Float32Array(0), index };
}

const SPECTRUM_POINTS = 256;
const SPECTRUM_RANGE_DB = 80;

/**
 * Espectro alrededor de `timeS` por el método de Welch: la media de tres
 * ventanas de 512 muestras solapadas a la mitad. Promediar quita el ruido de
 * la estimación sin borrar los armónicos.
 */
function spectrumAt(s: Signal, timeS: number): { hz: number[]; db: Float32Array } {
  const n = 512;
  const hop = n / 2;
  const center = Math.round(timeS * s.sampleRate);
  const power = new Float64Array(SPECTRUM_POINTS);
  for (let k = -1; k <= 1; k++) {
    const frame = new Float64Array(n);
    const start = center - n / 2 + k * hop;
    for (let i = 0; i < n; i++) frame[i] = s.samples[start + i] ?? 0;
    const db = frameSpectrumDb(frame, SPECTRUM_POINTS);
    for (let i = 0; i < SPECTRUM_POINTS; i++) power[i] += 10 ** (db[i] / 10) / 3;
  }
  const db = Float32Array.from(power, (p) => 10 * Math.log10(p + 1e-12));
  const nyquist = s.sampleRate / 2;
  const hz = Array.from(
    { length: SPECTRUM_POINTS },
    (_, i) => (i * nyquist) / (SPECTRUM_POINTS - 1),
  );
  return { hz, db };
}

/** Paso «redondo» (1, 2 o 5 × 10ⁿ) que deja unas `target` marcas en `span`. */
function niceStep(span: number, target: number): number {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const m = raw / mag;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * mag;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** Gráfica del espectro: kHz en X, dB en Y con un rango fijo de 80 dB bajo el pico. */
function spectrumPlot(signals: Signal[], timeS: number): Plot {
  const specs = signals.map((s) => spectrumAt(s, timeS));
  let peak = -Infinity;
  for (const { db } of specs) for (const v of db) peak = Math.max(peak, v);
  const top = Math.ceil(peak / 10) * 10;
  const bottom = top - SPECTRUM_RANGE_DB;
  const nyquist = Math.max(...signals.map((s) => s.sampleRate / 2));
  const kStep = niceStep(nyquist / 1000, 4);
  const xTicks = [];
  for (let k = 0; k * kStep * 1000 <= nyquist + 1e-6; k++) {
    const khz = +(k * kStep).toFixed(3);
    xTicks.push({ value: khz * 1000, label: fmt(khz) });
  }
  xTicks[xTicks.length - 1].label += ' kHz';
  const yTicks = [];
  for (let v = bottom; v <= top; v += 20) yTicks.push({ value: v, label: fmt(v) });
  yTicks[yTicks.length - 1].label += ' dB';
  return {
    kind: 'line',
    title: 'spectrumAt',
    series: specs.map(({ hz, db }, i) => ({
      role: specs.length === 2 && i === 0 ? ('in' as const) : ('out' as const),
      x: hz,
      y: db,
    })),
    xLabel: 'f',
    yLabel: 'dB',
    xRange: [0, nyquist],
    yRange: [bottom, top],
    xTicks,
    yTicks,
  };
}

const firstOf = <K extends PortValue['kind']>(values: (PortValue | undefined)[], kind: K) =>
  values.find((v): v is Extract<PortValue, { kind: K }> => v?.kind === kind);

/** Miniatura del nodo y gráficas de detalle para el instante elegido. */
export function inspectValues(
  inputs: (PortValue | undefined)[],
  outputs: (PortValue | undefined)[],
  timeS: number,
): { mini: Plot | null; detail: Plot[] } {
  const sin = firstOf(inputs, 'signal');
  const sout = firstOf(outputs, 'signal');
  const fout = firstOf(outputs, 'frames');
  const wave = (ms: number): Plot | null => {
    const series: Extract<Plot, { kind: 'line' }>['series'] = [];
    if (sin) series.push({ role: 'in', y: windowAt(sin, timeS, ms) });
    if (sout && (!sin || sout.sampleRate === sin.sampleRate))
      series.push({ role: 'out', y: windowAt(sout, timeS, ms) });
    else if (sout)
      return {
        kind: 'line',
        title: 'waveAt',
        series: [{ role: 'out', y: windowAt(sout, timeS, ms) }],
      };
    return series.length ? { kind: 'line', title: 'waveAt', series } : null;
  };
  const frame = (): Plot | null => {
    if (!fout) return null;
    const { frame: f, index } = frameAt(fout, timeS);
    const values = Array.from(f);
    return values.length <= 64
      ? {
          kind: 'bars',
          title: 'frameAt',
          values: values.map(Math.abs),
          labels: values.map((v, k) => `${k}: ${v.toFixed(3)} (trama ${index + 1})`),
        }
      : { kind: 'line', title: 'frameAt', series: [{ role: 'out', y: f }] };
  };

  const mini = (fout && !sout ? frame() : wave(12)) ?? frame();
  const detail: Plot[] = [];
  const big = wave(30);
  if (big) detail.push(big);
  const spec = [sin, sout].filter((s): s is Signal => !!s);
  if (spec.length) detail.push(spectrumPlot(spec, timeS));
  const fr = frame();
  if (fr) detail.push(fr);
  return { mini, detail };
}

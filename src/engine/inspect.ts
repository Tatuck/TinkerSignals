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

function spectrumAt(s: Signal, timeS: number): { hz: number[]; db: Float32Array } {
  const n = 512;
  const center = Math.round(timeS * s.sampleRate);
  const frame = new Float64Array(n);
  for (let i = 0; i < n; i++) frame[i] = s.samples[center - n / 2 + i] ?? 0;
  const db = frameSpectrumDb(frame, 160);
  return { hz: Array.from({ length: 160 }, (_, i) => (i * s.sampleRate) / 2 / 159), db };
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
  if (spec.length) {
    detail.push({
      kind: 'line',
      title: 'spectrumAt',
      series: spec.map((s, i) => {
        const { hz, db } = spectrumAt(s, timeS);
        return {
          role: spec.length === 2 && i === 0 ? ('in' as const) : ('out' as const),
          x: hz,
          y: db,
        };
      }),
      xLabel: 'f',
      yLabel: 'dB',
    });
  }
  const fr = frame();
  if (fr) detail.push(fr);
  return { mini, detail };
}

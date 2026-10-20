import { interestingWindow, makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

const RATES = ['8000', '16000', '22050', '44100', '48000'] as const;

export default defineBlock({
  id: 'generator',
  category: 'entrada',
  icon: '〰️',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: {
    waveform: {
      type: 'select',
      default: 'vowel',
      options: ['sine', 'square', 'chirp', 'noise', 'harmonics', 'vowel'] as const,
    },
    frequency: { type: 'number', default: 220, min: 20, max: 8000, step: 1, unit: 'Hz', scale: 'log' },
    amplitude: { type: 'number', default: 0.8, min: 0, max: 1, step: 0.01 },
    duration: { type: 'number', default: 2, min: 0.1, max: 10, step: 0.1, unit: 's' },
    sampleRate: { type: 'select', default: '16000', options: RATES },
  },
  process({ params }) {
    const fs = Number(params.sampleRate);
    const n = Math.round(params.duration * fs);
    const x = new Float32Array(n);
    const f = params.frequency;
    const A = params.amplitude;
    let seed = 12345; // ruido determinista: mismo resultado en cada ejecución
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff) * 2 - 1;

    for (let i = 0; i < n; i++) {
      const t = i / fs;
      switch (params.waveform) {
        case 'sine':
          x[i] = Math.sin(2 * Math.PI * f * t);
          break;
        case 'square':
          x[i] = Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1;
          break;
        case 'chirp': {
          // Barrido lineal de f hasta fs/2 a lo largo de toda la duración.
          const f1 = fs / 2;
          x[i] = Math.sin(2 * Math.PI * (f * t + ((f1 - f) / (2 * params.duration)) * t * t));
          break;
        }
        case 'noise':
          x[i] = rand();
          break;
        case 'harmonics':
          x[i] = 0;
          for (let k = 1; k <= 6 && k * f < fs / 2; k++) x[i] += Math.sin(2 * Math.PI * k * f * t) / k;
          x[i] /= 2.45;
          break;
        case 'vowel':
          x[i] = 0; // se rellena abajo
          break;
      }
    }
    if (params.waveform === 'vowel') synthVowel(x, fs, f);
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
    if (pk > 0) for (let i = 0; i < n; i++) x[i] = (x[i] / pk) * A;

    // Unos pocos periodos: así se ve la forma de onda y no un bloque macizo.
    const periods = params.waveform === 'noise' || params.waveform === 'chirp' ? 4 : 3;
    const win = interestingWindow(x, Math.max(32, Math.round((periods * fs) / f)));
    return {
      outputs: { out: makeSignal(x, fs) },
      metrics: [
        { key: 'sampleRate', value: fs, unit: 'Hz', highlight: true },
        { key: 'duration', value: params.duration, unit: 's' },
      ],
      plots: [{ kind: 'line', title: 'wave', series: [{ role: 'out', y: x.slice(win[0], win[1]) }] }],
    };
  },
});

/**
 * "A" sintética: tren de pulsos glotales filtrado por tres resonadores
 * (formantes ~730, 1090, 2440 Hz). Es el modelo fuente-filtro del Tema 3,
 * así que viene muy bien para probar LPC y CELP sin micrófono.
 */
function synthVowel(x: Float32Array, fs: number, f0: number): void {
  const period = Math.max(2, Math.round(fs / f0));
  const formants = [
    [730, 90],
    [1090, 110],
    [2440, 170],
  ].filter(([f]) => f < fs / 2);
  for (let i = 0; i < x.length; i++) x[i] = i % period === 0 ? 1 : 0;
  for (const [fc, bw] of formants) {
    const r = Math.exp((-Math.PI * bw) / fs);
    const a1 = 2 * r * Math.cos((2 * Math.PI * fc) / fs);
    const a2 = -r * r;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = x[i] + a1 * y1 + a2 * y2;
      y2 = y1;
      y1 = y;
      x[i] = y;
    }
  }
  // Envolvente suave de entrada y salida para que no haga "clic".
  const ramp = Math.min(x.length / 4, fs * 0.03);
  for (let i = 0; i < ramp; i++) {
    x[i] *= i / ramp;
    x[x.length - 1 - i] *= i / ramp;
  }
}

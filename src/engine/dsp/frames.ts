import type { Frames, Signal } from '../types';

export type WindowName = NonNullable<Frames['window']>;

export function makeWindow(name: WindowName, n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    switch (name) {
      case 'rect':
        w[i] = 1;
        break;
      case 'hann':
        w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
        break;
      case 'hamming':
        w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / Math.max(1, n - 1));
        break;
      case 'sine':
        w[i] = Math.sin((Math.PI * (i + 0.5)) / n);
        break;
    }
  }
  return w;
}

/** Trocea una señal en tramas de `size` muestras cada `hop`, aplicando una ventana. */
export function toFrames(x: Signal, size: number, hop: number, window: WindowName): Frames {
  const w = makeWindow(window, size);
  const count = Math.max(1, Math.ceil(x.samples.length / hop));
  const data: Float32Array[] = [];
  for (let f = 0; f < count; f++) {
    const start = f * hop;
    const frame = new Float32Array(size);
    for (let i = 0; i < size; i++) frame[i] = (x.samples[start + i] ?? 0) * w[i];
    data.push(frame);
  }
  return { kind: 'frames', domain: 'time', sampleRate: x.sampleRate, hop, size, numSamples: x.samples.length, data, window };
}

/**
 * Une tramas solapándolas y sumándolas. Divide por la suma de las ventanas
 * que caen en cada muestra, así que deshace la ventana de análisis sea cual sea.
 */
export function overlapAdd(f: Frames): Signal {
  const y = new Float64Array(f.numSamples);
  const norm = new Float64Array(f.numSamples);
  const w = makeWindow(f.window ?? 'rect', f.size);
  f.data.forEach((frame, k) => {
    const start = k * f.hop;
    for (let i = 0; i < f.size && start + i < f.numSamples; i++) {
      y[start + i] += frame[i];
      norm[start + i] += w[i];
    }
  });
  const out = new Float32Array(f.numSamples);
  for (let i = 0; i < out.length; i++) out[i] = norm[i] > 1e-6 ? y[i] / norm[i] : 0;
  return { kind: 'signal', samples: out, sampleRate: f.sampleRate };
}

/** Aplica una función a cada trama y devuelve unas tramas nuevas. */
export function mapFrames(f: Frames, domain: Frames['domain'], fn: (frame: Float32Array, index: number) => Float32Array): Frames {
  const data = f.data.map(fn);
  return { ...f, domain, data, size: data[0]?.length ?? f.size };
}

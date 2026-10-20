import type { Signal } from '@/engine/types';
import { encodeWav } from '@/engine/dsp/wav';

/** Duración máxima que se carga: suficiente para experimentar sin que el cálculo se haga eterno. */
export const MAX_SECONDS = 30;

let ctx: AudioContext | null = null;
const audioCtx = () => (ctx ??= new AudioContext());

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  trimmedS?: number;
}

/** Decodifica cualquier formato que entienda el navegador y lo pasa a mono. */
export async function decodeAudio(data: ArrayBuffer): Promise<DecodedAudio> {
  const buf = await audioCtx().decodeAudioData(data);
  const max = Math.min(buf.length, Math.round(MAX_SECONDS * buf.sampleRate));
  const mono = new Float32Array(max);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < max; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  return {
    samples: mono,
    sampleRate: buf.sampleRate,
    trimmedS: buf.length > max ? MAX_SECONDS : undefined,
  };
}

// ─── Reproducción ───────────────────────────────────────────────────────────

let current: { source: AudioBufferSourceNode; key: string } | null = null;
const listeners = new Set<(key: string | null) => void>();

/** Suscribirse a qué se está reproduciendo (para pintar botones de "parar"). */
export function onPlaybackChange(fn: (key: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = (key: string | null) => listeners.forEach((l) => l(key));

export function play(signal: Signal, key: string): void {
  stop();
  const c = audioCtx();
  void c.resume();
  const buf = c.createBuffer(1, signal.samples.length, signal.sampleRate);
  buf.copyToChannel(clip(signal.samples), 0);
  const source = c.createBufferSource();
  source.buffer = buf;
  source.connect(c.destination);
  source.onended = () => {
    if (current?.source === source) {
      current = null;
      emit(null);
    }
  };
  source.start();
  current = { source, key };
  emit(key);
}

export function stop(): void {
  if (!current) return;
  const s = current.source;
  current = null;
  s.onended = null;
  s.stop();
  emit(null);
}

function clip(x: Float32Array): Float32Array<ArrayBuffer> {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.max(-1, Math.min(1, x[i]));
  return y;
}

export function downloadWav(signal: Signal, filename: string): void {
  const blob = new Blob([encodeWav(signal) as Uint8Array<ArrayBuffer>], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Grabación ──────────────────────────────────────────────────────────────

export interface Recording {
  stop(): Promise<DecodedAudio>;
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise((resolve, reject) => {
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          try {
            const data = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer();
            resolve(await decodeAudio(data));
          } catch (e) {
            reject(e);
          }
        };
        rec.stop();
      }),
  };
}

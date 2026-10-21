import * as Comlink from 'comlink';
import type { EngineApi, Scope } from './worker';

export type { Scope };

/** Proxy al motor que vive en el Web Worker. Todas las llamadas son asíncronas. */
export const engine = Comlink.wrap<EngineApi>(
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
);

export async function setAsset(id: string, samples: Float32Array, sampleRate: number) {
  // Se envía una copia transferible para no bloquear con la clonación.
  const copy = samples.slice();
  await engine.setAsset(id, Comlink.transfer(copy, [copy.buffer]), sampleRate);
}

export async function setImageAsset(
  id: string,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
) {
  const copy = rgba.slice();
  await engine.setImageAsset(id, width, height, Comlink.transfer(copy, [copy.buffer]));
}

import * as Comlink from 'comlink';
import type { EngineApi } from './worker';

/** Proxy al motor que vive en el Web Worker. Todas las llamadas son asíncronas. */
export const engine = Comlink.wrap<EngineApi>(
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
);

export async function setAsset(id: string, samples: Float32Array, sampleRate: number) {
  // Se envía una copia transferible para no bloquear con la clonación.
  const copy = samples.slice();
  await engine.setAsset(id, Comlink.transfer(copy, [copy.buffer]), sampleRate);
}

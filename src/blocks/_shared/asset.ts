import { BlockWaiting } from '@/engine/errors';
import type { Signal } from '@/engine/types';

/** Recupera un audio externo o deja el nodo "esperando" con un mensaje claro. */
export function loadAsset(id: string | null, getAsset: (id: string) => Signal | undefined): Signal {
  if (!id) throw new BlockWaiting('Todavía no hay audio: carga un archivo o graba algo');
  const s = getAsset(id);
  if (!s) throw new BlockWaiting('El audio ya no está disponible; vuelve a cargarlo');
  return s;
}

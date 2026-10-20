import { useEffect, useState } from 'react';
import type { Plot } from '@/engine/types';
import { engine } from '@/runtime/client';
import { useGraphStore, useStore } from '../store';

export interface Instant {
  mini: Plot | null;
  detail: Plot[];
}

/**
 * Gráficas de un bloque en el instante de la lupa temporal. Se piden al
 * Worker cuando cambia el instante o el resultado del bloque.
 */
export function useInstant(nodeId: string): { time: number; data: Instant | null } | null {
  const time = useStore((s) => s.cursor);
  const useS = useGraphStore();
  const scope = useS((s) => s.scope);
  const result = useS((s) => s.results?.nodes[nodeId]);
  const [data, setData] = useState<{ time: number; data: Instant | null } | null>(null);

  useEffect(() => {
    if (time === null || result?.status !== 'ok') return;
    let alive = true;
    void engine.inspectAt(nodeId, time, scope).then((d) => alive && setData({ time, data: d }));
    return () => {
      alive = false;
    };
  }, [nodeId, time, scope, result]);

  return time === null ? null : data;
}

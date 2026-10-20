/// <reference lib="webworker" />
/**
 * Punto de composición: aquí se juntan el motor y los bloques reales.
 * Todo el cálculo pesado ocurre en este Web Worker para que la interfaz
 * nunca se congele.
 */
import * as Comlink from 'comlink';
import { createRegistry } from '@/blocks';
import { Engine } from '@/engine/evaluator';
import type { Graph, Signal } from '@/engine/types';
import { probe } from './probe';

const engine = new Engine(createRegistry());

const api = {
  run: (graph: Graph) => engine.run(graph),
  setAsset: (id: string, samples: Float32Array, sampleRate: number) =>
    engine.setAsset(id, { kind: 'signal', samples, sampleRate }),
  deleteAsset: (id: string) => engine.deleteAsset(id),
  probeOutput(nodeId: string, port: string) {
    const v = engine.getValue(nodeId, port);
    return v ? probe(v) : null;
  },
  /** Señal completa de una salida o de una entrada (para escuchar o descargar). */
  getSignal(nodeId: string, port: string, side: 'out' | 'in'): Signal | null {
    const v = side === 'out' ? engine.getValue(nodeId, port) : engine.getInputValue(nodeId, port);
    return v?.kind === 'signal' ? v : null;
  },
};

export type EngineApi = typeof api;
Comlink.expose(api);

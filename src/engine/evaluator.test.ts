import { describe, expect, it } from 'vitest';
import { makeSignal } from './dsp/signal';
import { Engine } from './evaluator';
import { BlockRegistry } from './registry';
import { defineBlock, type Graph } from './types';

// Bloques de juguete para probar el motor sin depender de los reales.
let sourceCalls = 0;
const source = defineBlock({
  id: 'src',
  category: 'entrada',
  icon: '',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: { value: { type: 'number', default: 1, min: 0, max: 10 } },
  process: ({ params }) => {
    sourceCalls++;
    return { outputs: { out: makeSignal(new Float32Array([params.value]), 8000) }, latencyMs: 5 };
  },
});
const double = defineBlock({
  id: 'double',
  category: 'utilidades',
  icon: '',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: { delay: { type: 'number', default: 10, min: 0, max: 100 } },
  process: ({ inputs, params }) => ({
    outputs: {
      out: makeSignal(
        inputs.in.samples.map((v) => v * 2),
        8000,
      ),
    },
    latencyMs: params.delay,
  }),
});
const boom = defineBlock({
  id: 'boom',
  category: 'utilidades',
  icon: '',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },
  params: {},
  process: () => {
    throw new Error('¡pum!');
  },
});
const bitsSink = defineBlock({
  id: 'bitsSink',
  category: 'salida',
  icon: '',
  inputs: { in: { type: 'bitstream' } },
  outputs: {},
  params: {},
  process: () => ({ outputs: {} }),
});

const registry = new BlockRegistry([source, double, boom, bitsSink]);
const edge = (id: string, source: string, target: string, targetPort = 'in') => ({
  id,
  source,
  sourcePort: 'out',
  target,
  targetPort,
});

describe('Engine', () => {
  it('ejecuta en orden topológico aunque los nodos estén desordenados', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'double', params: {} },
        { id: 'b', type: 'double', params: {} },
        { id: 'a', type: 'src', params: { value: 3 } },
      ],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    };
    const engine = new Engine(registry);
    const r = engine.run(g);
    expect(r.nodes.c.status).toBe('ok');
    expect((engine.getValue('c', 'out') as { samples: Float32Array }).samples[0]).toBe(12);
  });

  it('acumula el retardo algorítmico a lo largo del camino', () => {
    const g: Graph = {
      nodes: [
        { id: 'a', type: 'src', params: {} },
        { id: 'b', type: 'double', params: { delay: 20 } },
        { id: 'c', type: 'double', params: { delay: 7.5 } },
      ],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    };
    const r = new Engine(registry).run(g);
    expect(r.nodes.b.ownLatencyMs).toBe(20);
    expect(r.nodes.c.outputs.out.latencyMs).toBe(32.5);
  });

  it('usa la caché y solo recalcula lo que cambia', () => {
    const engine = new Engine(registry);
    const g: Graph = {
      nodes: [
        { id: 'a', type: 'src', params: {} },
        { id: 'b', type: 'double', params: {} },
      ],
      edges: [edge('e1', 'a', 'b')],
    };
    sourceCalls = 0;
    engine.run(g);
    const r2 = engine.run(g);
    expect(sourceCalls).toBe(1);
    expect(r2.nodes.a.cached).toBe(true);

    g.nodes[1].params = { delay: 50 };
    const r3 = engine.run(g);
    expect(sourceCalls).toBe(1);
    expect(r3.nodes.a.cached).toBe(true);
    expect(r3.nodes.b.cached).toBe(false);
  });

  it('aísla los errores: un bloque roto no tumba al resto', () => {
    const g: Graph = {
      nodes: [
        { id: 'a', type: 'src', params: {} },
        { id: 'x', type: 'boom', params: {} },
        { id: 'after', type: 'double', params: {} },
        { id: 'ok', type: 'double', params: {} },
      ],
      edges: [edge('e1', 'a', 'x'), edge('e2', 'x', 'after'), edge('e3', 'a', 'ok')],
    };
    const r = new Engine(registry).run(g);
    expect(r.nodes.x.status).toBe('error');
    expect(r.nodes.x.error).toBe('¡pum!');
    expect(r.nodes.after.status).toBe('waiting');
    expect(r.nodes.ok.status).toBe('ok');
  });

  it('rechaza cables con tipos incompatibles', () => {
    const g: Graph = {
      nodes: [
        { id: 'a', type: 'src', params: {} },
        { id: 's', type: 'bitsSink', params: {} },
      ],
      edges: [edge('e1', 'a', 's')],
    };
    const r = new Engine(registry).run(g);
    expect(r.graphErrors[0]).toMatchObject({ edgeId: 'e1' });
    expect(r.nodes.s.status).toBe('waiting');
  });

  it('detecta bucles', () => {
    const g: Graph = {
      nodes: [
        { id: 'b', type: 'double', params: {} },
        { id: 'c', type: 'double', params: {} },
      ],
      edges: [edge('e1', 'b', 'c'), edge('e2', 'c', 'b')],
    };
    const r = new Engine(registry).run(g);
    expect(r.nodes.b.status).toBe('error');
    expect(r.graphErrors.some((e) => e.nodeId === 'b')).toBe(true);
  });

  it('recorta parámetros fuera de rango en lugar de fallar', () => {
    const engine = new Engine(registry);
    engine.run({ nodes: [{ id: 'a', type: 'src', params: { value: 99 } }], edges: [] });
    expect((engine.getValue('a', 'out') as { samples: Float32Array }).samples[0]).toBe(10);
  });
});

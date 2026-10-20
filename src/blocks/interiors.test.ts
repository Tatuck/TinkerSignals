import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import { snr } from '@/engine/dsp/metrics';
import { resolveParams } from '@/engine/registry';
import type { Graph, InteriorInputs, ParamValue } from '@/engine/types';
import { createRegistry } from './index';

const registry = createRegistry();

/**
 * Ejecuta generador → bloque en el circuito principal y el interior del
 * bloque con la misma entrada, y devuelve las dos salidas para compararlas.
 */
function runBoth(type: string, params: Record<string, ParamValue>, gen: Record<string, ParamValue> = {}) {
  const def = registry.get(type)!;
  const main = new Engine(registry);
  const r = main.run({
    nodes: [
      { id: 'g', type: 'generator', params: { waveform: 'vowel', duration: 1, ...gen } },
      { id: 'b', type, params },
    ],
    edges: [{ id: 'e', source: 'g', sourcePort: 'out', target: 'b', targetPort: 'in' }],
  });
  expect(r.nodes.b.status, r.nodes.b.error).toBe('ok');
  const inputs: InteriorInputs = { in: r.nodes.g.outputs.out.summary };
  const g = def.interior!(resolveParams(def.params, params) as never, inputs);
  const inner = new Engine(registry);
  inner.setExternal('inner:in', main.getInputValue('b', 'in')!);
  const graph: Graph = {
    nodes: g.nodes.map((n) => ({ id: n.id, type: n.type, params: n.params ?? {} })),
    edges: g.edges.map(([s, sp, d, dp], i) => ({ id: `e${i}`, source: s, sourcePort: sp, target: d, targetPort: dp })),
  };
  const ir = inner.run(graph);
  for (const [id, n] of Object.entries(ir.nodes)) expect(n.status, `${type}/${id}: ${n.error}`).toBe('ok');
  const [node, port] = Object.values(g.outputs)[0] ?? [];
  return { real: main.getValue('b', Object.keys(def.outputs)[0]), inner: node ? inner.getValue(node, port) : undefined, ir };
}

describe('interiores', () => {
  it('el cuantizador no uniforme por dentro da lo mismo', () => {
    const { real, inner } = runBoth('quantizer-nonuniform', { bits: 5, law: 'mu' });
    expect(real?.kind === 'signal' && inner?.kind === 'signal' && snr(real.samples, inner.samples)).toBeGreaterThan(100);
  });

  it.each(['linear', 'mu', 'a'])('el PCM (%s) por dentro da exactamente los mismos bits', (law) => {
    const { real, inner } = runBoth('pcm-encoder', { bits: 6, law });
    expect(real?.kind).toBe('bitstream');
    expect(inner?.kind).toBe('bitstream');
    if (real?.kind === 'bitstream' && inner?.kind === 'bitstream') expect([...inner.bytes]).toEqual([...real.bytes]);
  });

  it.each([
    ['16000', '8000', 'normal'],
    ['8000', '16000', 'steep'],
  ])('el muestreador %s → %s Hz por dentro da lo mismo', (from, to, steepness) => {
    const { real, inner } = runBoth('resampler', { sampleRate: to, steepness }, { sampleRate: from });
    expect(real?.kind === 'signal' && inner?.kind === 'signal' && snr(real.samples, inner.samples)).toBeGreaterThan(90);
  });

  it.each(['low', 'largest'])('la transformada (%s) por dentro da lo mismo', (selection) => {
    const { real, inner } = runBoth('transform-codec', { blockSize: '128', keep: 30, bits: 5, selection });
    expect(real?.kind === 'signal' && inner?.kind === 'signal' && snr(real.samples, inner.samples)).toBeGreaterThan(60);
  });

  it.each(['subband-encoder', 'lpc-encoder', 'mpeg1-encoder'])('el interior de %s se ejecuta entero', (type) => {
    runBoth(type, {}, type === 'subband-encoder' ? { sampleRate: '16000' } : type === 'mpeg1-encoder' ? { sampleRate: '32000' } : { sampleRate: '8000' });
  });
});

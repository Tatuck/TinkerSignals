import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import { examples, instantiate } from './examples';
import { registry } from './registry';

describe('ejemplos', () => {
  it.each(examples.map((e) => [e.id, e] as const))('«%s» es un circuito válido', (_, ex) => {
    const { nodes, edges } = instantiate(ex);
    expect(nodes).toHaveLength(ex.nodes.length);
    expect(edges).toHaveLength(ex.edges.length);
    const r = new Engine(registry).run({
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.blockType, params: n.data.params })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourcePort: e.sourceHandle!,
        target: e.target,
        targetPort: e.targetHandle!,
      })),
    });
    expect(r.graphErrors).toEqual([]);
    for (const [id, n] of Object.entries(r.nodes)) {
      expect(n.status, `${ex.id}/${id}: ${n.error}`).not.toBe('error');
    }
  });
});

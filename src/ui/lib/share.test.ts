import { describe, expect, it } from 'vitest';
import { examples, instantiate } from '../examples';
import { decodeCircuit, encodeCircuit } from './share';

describe('enlaces para compartir', () => {
  it.each(examples.map((e) => [e.id, e] as const))(
    '«%s» sobrevive a la ida y vuelta',
    async (_, ex) => {
      const g = instantiate(ex);
      const code = await encodeCircuit(g.nodes, g.edges);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      const back = await decodeCircuit(code);
      expect(back.nodes.map((n) => [n.id, n.data.blockType, n.position])).toEqual(
        g.nodes.map((n) => [
          n.id,
          n.data.blockType,
          { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        ]),
      );
      expect(back.nodes.map((n) => n.data.params)).toEqual(
        g.nodes.map((n) =>
          Object.fromEntries(Object.entries(n.data.params).filter(([k]) => k !== 'audio')),
        ),
      );
      expect(back.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual(
        g.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle]),
      );
    },
  );

  it('el enlace es corto', async () => {
    const g = instantiate(examples.find((e) => e.id === 'voip')!);
    expect((await encodeCircuit(g.nodes, g.edges)).length).toBeLessThan(800);
  });
});

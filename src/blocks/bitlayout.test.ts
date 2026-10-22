import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import type { Bitstream, Graph } from '@/engine/types';
import { blockText } from '@/i18n';
import { createRegistry } from './index';

/**
 * Rayos X de los bits: el mapa que deja cada codificador tiene que describir
 * exactamente su flujo, y cada campo que escribe tiene que tener su texto.
 */
const registry = createRegistry();

function encode(type: string, params = {}): Bitstream {
  const source =
    type === 'jpeg-encoder'
      ? { id: 's', type: 'image-source', params: { size: '64' } }
      : {
          id: 's',
          type: 'generator',
          params: { waveform: 'vowel', duration: 0.3, sampleRate: '16000' },
        };
  const engine = new Engine(registry);
  const graph: Graph = {
    nodes: [source, { id: 'enc', type, params }],
    edges: [{ id: 'e', source: 's', sourcePort: 'out', target: 'enc', targetPort: 'in' }],
  };
  const r = engine.run(graph);
  expect(r.nodes.enc.status, r.nodes.enc.error).toBe('ok');
  return engine.getValue('enc', 'out') as Bitstream;
}

const LABELLED = [
  'pcm-encoder',
  'dpcm-encoder',
  'adpcm-encoder',
  'lpc-encoder',
  'celp-encoder',
  'subband-encoder',
  'mpeg1-encoder',
  'jpeg-encoder',
];

describe('mapa de bits', () => {
  for (const type of LABELLED)
    it(`${type}: los tramos cubren el flujo sin huecos y cada campo tiene texto`, () => {
      const b = encode(type);
      const layout = b.layout!;
      expect(layout, 'el codificador no deja mapa').toBeDefined();
      expect(layout.block).toBe(type);
      expect(layout.bitLength).toBe(b.bitLength);
      // Los totales son exactos aunque se llegue al tope de tramos.
      const total = layout.totals.reduce((a, n) => a + n, 0);
      expect(total).toBeLessThanOrEqual(b.bitLength);
      expect(total).toBeGreaterThan(0.9 * b.bitLength);
      // Los tramos guardados van en orden y no se solapan.
      for (let i = 1; i < layout.spans.length; i++)
        expect(layout.spans[i].start).toBeGreaterThanOrEqual(
          layout.spans[i - 1].start + layout.spans[i - 1].length,
        );
      const fields = blockText(type).fields ?? {};
      for (const f of layout.fields) expect(fields[f]?.label, `${type}: campo «${f}»`).toBeTruthy();
    });

  it('los bits que marca el canal son justo los que han cambiado', () => {
    const engine = new Engine(registry);
    engine.run({
      nodes: [
        { id: 's', type: 'generator', params: { duration: 0.3 } },
        { id: 'enc', type: 'pcm-encoder', params: {} },
        { id: 'ch', type: 'bit-errors', params: { ber: 0.01 } },
      ],
      edges: [
        { id: 'a', source: 's', sourcePort: 'out', target: 'enc', targetPort: 'in' },
        { id: 'b', source: 'enc', sourcePort: 'out', target: 'ch', targetPort: 'in' },
      ],
    });
    const before = engine.getValue('enc', 'out') as Bitstream;
    const after = engine.getValue('ch', 'out') as Bitstream;
    const flipped: number[] = [];
    for (let i = 0; i < after.bitLength; i++) {
      const bit = (bytes: Uint8Array) => (bytes[i >> 3] >> (7 - (i & 7))) & 1;
      if (bit(before.bytes) !== bit(after.bytes)) flipped.push(i);
    }
    const marked = (after.damaged ?? []).flatMap(([s, n]) =>
      Array.from({ length: n }, (_, k) => s + k),
    );
    expect(flipped.length).toBeGreaterThan(0);
    expect([...new Set(marked)].sort((a, b) => a - b)).toEqual(flipped);
    // El mapa sigue valiendo: el canal no mueve los bits de sitio.
    expect(after.layout).toBe(before.layout);
  });
});

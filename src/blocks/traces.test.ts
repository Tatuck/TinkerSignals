import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import type { Graph, Plot } from '@/engine/types';
import { createRegistry } from './index';
import { parseValues } from './number-list';

/**
 * Las tablas paso a paso (gráfica `table`) tienen que dar lo mismo que el
 * ejercicio hecho a mano: los problemas y las lecciones leen sus celdas.
 */
const registry = createRegistry();

type Table = Extract<Plot, { kind: 'table' }>;

/** Ejecuta fuente → bloque y devuelve las tablas y métricas del bloque. */
function run(source: Graph['nodes'][number], block: string, params = {}) {
  const engine = new Engine(registry);
  const result = engine.run({
    nodes: [source, { id: 'b', type: block, params }],
    edges: [{ id: 'e', source: source.id, sourcePort: 'out', target: 'b', targetPort: 'in' }],
  });
  const node = result.nodes.b;
  expect(node.status).toBe('ok');
  return {
    table: (title: string) =>
      node.plots.find((p): p is Table => p.kind === 'table' && p.title === title)!,
    metric: (key: string) => node.metrics.find((m) => m.key === key)?.value,
  };
}

const text = (t: string) => ({
  id: 's',
  type: 'text-source',
  params: { text: t, encoding: 'utf-8' },
});

describe('tablas paso a paso', () => {
  it('LZW reproduce el ejemplo clásico TOBEORNOT…', () => {
    const r = run(text('TOBEORNOTTOBEORTOBEORNOT'), 'lzw-encoder', { symbolBits: '8' });
    const codes = r.table('dictionary').rows.map((row) => row[3]);
    expect(codes).toEqual([84, 79, 66, 69, 79, 82, 78, 79, 84, 256, 258, 260, 265, 259, 261, 263]);
    // La primera entrada nueva es «TO» con el código 256.
    expect(r.table('dictionary').rows[0][5]).toBe('256 = «TO»');
  });

  it('Huffman: la longitud media de la tabla es Σ p·l', () => {
    const r = run(text('AAAAAAAABBBBCCD'), 'huffman-encoder', { symbolBits: '8' });
    const t = r.table('codes');
    const avg = t.rows.reduce((s, row) => s + Number(row[2]) * Number(row[4]), 0);
    expect(avg).toBeCloseTo(r.metric('avgLength')!, 9);
    // p = 8/15, 4/15, 2/15, 1/15 → longitudes 1, 2, 3, 3.
    expect(t.rows.map((row) => row[4])).toEqual([1, 2, 3, 3]);
  });

  it('aritmética: el ancho final es el producto de las probabilidades', () => {
    const r = run(text('ABAC'), 'arithmetic-encoder', { symbolBits: '8' });
    const steps = r.table('steps').rows;
    expect(steps).toHaveLength(4);
    // p(A) = 1/2, p(B) = p(C) = 1/4 → ancho = 1/2 · 1/4 · 1/2 · 1/4.
    expect(Number(steps[3][5])).toBeCloseTo(1 / 64, 4);
  });

  it('DPCM: lo reconstruido es la predicción más el error cuantizado', () => {
    const r = run(
      { id: 's', type: 'generator', params: { waveform: 'vowel', duration: 0.2 } },
      'dpcm-encoder',
      { order: 2, bits: 4 },
    );
    const rows = r.table('trace').rows;
    expect(rows).toHaveLength(16);
    for (const [, , pred, , , eq, xq] of rows)
      expect(Number(xq)).toBeCloseTo(Number(pred) + Number(eq), 5);
  });

  it('JPEG: los bits del bloque elegido suman lo que dice la nota', () => {
    const r = run({ id: 's', type: 'image-source', params: {} }, 'jpeg-encoder', {
      quality: 50,
      traceBlock: 5,
    });
    const bits = r.table('blockBits');
    const total = bits.rows.reduce((s, row) => s + Number(row[6]), 0);
    expect(bits.notes!.join(' ')).toContain(`**${total} bits**`);
    expect(bits.rows[0][0]).toBe('DC');
    // Cada fila de la tabla cuantizada es round(DCT / Q).
    const dct = r.table('blockDct').rows;
    const q = r.table('blockTable').rows;
    const fq = r.table('blockQuant').rows;
    for (let y = 0; y < 8; y++)
      for (let x = 1; x <= 8; x++)
        expect(Math.abs(Number(fq[y][x]) - Number(dct[y][x]) / Number(q[y][x]))).toBeLessThan(0.51);
  });
});

describe('lista de números', () => {
  it('entiende las formas habituales de escribir muestras', () => {
    expect(parseValues('150, 160, 162, 175')).toEqual([150, 160, 162, 175]);
    expect(parseValues('4,3 −2,6 5,7 -6,2')).toEqual([4.3, -2.6, 5.7, -6.2]);
    expect(parseValues('0.1, 0.09, -0.05')).toEqual([0.1, 0.09, -0.05]);
    expect(parseValues('0,5; 1,25; -3')).toEqual([0.5, 1.25, -3]);
    expect(parseValues('4,3')).toEqual([4.3]);
    expect(parseValues('  ')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import { createRegistry } from './index';

describe('bloques reales', () => {
  const registry = createRegistry();

  it('se autodescubren', () => {
    expect(registry.list().length).toBeGreaterThan(3);
  });

  it('cada bloque tiene su traducción completa', async () => {
    const locales = import.meta.glob<{ default: Record<string, unknown> }>('./*/locales/es.json', {
      eager: true,
    });
    for (const b of registry.list()) {
      const t = locales[`./${b.id}/locales/es.json`]?.default as
        | {
            title?: string;
            summary?: string;
            params?: Record<string, unknown>;
            ports?: Record<string, unknown>;
          }
        | undefined;
      expect(t, `falta locales/es.json en ${b.id}`).toBeDefined();
      expect(t!.title, b.id).toBeTruthy();
      expect(t!.summary, b.id).toBeTruthy();
      for (const p of Object.keys(b.params))
        expect(t!.params?.[p], `${b.id}.params.${p}`).toBeDefined();
      for (const p of [...Object.keys(b.inputs), ...Object.keys(b.outputs)]) {
        expect(t!.ports?.[p], `${b.id}.ports.${p}`).toBeDefined();
      }
    }
  });

  it('generador → cuantizador → salida funciona de punta a punta', () => {
    const engine = new Engine(registry);
    const r = engine.run({
      nodes: [
        { id: 'g', type: 'generator', params: { waveform: 'sine', frequency: 440 } },
        { id: 'q', type: 'quantizer-uniform', params: { bits: 8 } },
        { id: 'o', type: 'output', params: {} },
      ],
      edges: [
        { id: 'e1', source: 'g', sourcePort: 'out', target: 'q', targetPort: 'in' },
        { id: 'e2', source: 'q', sourcePort: 'out', target: 'o', targetPort: 'in' },
      ],
    });
    expect(r.nodes.o.status).toBe('ok');
    const s = r.nodes.q.metrics.find((m) => m.key === 'snr')!.value;
    expect(s).toBeGreaterThan(40);
  });

  it('un archivo sin cargar queda "esperando", no en error', () => {
    const r = new Engine(registry).run({
      nodes: [{ id: 'f', type: 'audio-file', params: {} }],
      edges: [],
    });
    expect(r.nodes.f.status).toBe('waiting');
  });
});

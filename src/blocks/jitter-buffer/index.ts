import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'jitter-buffer',
  category: 'canal',
  icon: '🪣',
  inputs: { in: { type: 'packets' } },
  outputs: { out: { type: 'packets' } },
  params: {
    bufferMs: { type: 'number', default: 40, min: 0, max: 300, step: 5, unit: 'ms' },
  },
  process({ inputs, params }) {
    const pks = inputs.in.packets;
    // El receptor estima el retardo base con los primeros paquetes (el menor
    // de los 10 primeros) y reproduce cada paquete `bufferMs` después de eso:
    // ese margen es el que absorbe el jitter.
    const early = pks.filter((p) => p.arrivalMs !== null).slice(0, 10);
    const base = early.length ? Math.min(...early.map((p) => p.arrivalMs! - p.sentMs)) : 0;
    const offset = base + params.bufferMs;
    let late = 0;
    const packets = pks.map((p) => {
      if (p.arrivalMs === null) return p;
      const deadline = p.sentMs + offset;
      if (p.arrivalMs > deadline) {
        late++;
        return { ...p, arrivalMs: null, lostReason: 'late' as const };
      }
      return p;
    });
    const missing = packets.filter((p) => p.arrivalMs === null).length;
    return {
      outputs: { out: { ...inputs.in, packets } },
      metrics: [
        {
          key: 'latePct',
          value: (100 * late) / Math.max(1, pks.length),
          unit: '%',
          highlight: true,
        },
        {
          key: 'missingPct',
          value: (100 * missing) / Math.max(1, pks.length),
          unit: '%',
          highlight: true,
        },
        { key: 'late', value: late, unit: 'paq.' },
      ],
      latencyMs: params.bufferMs,
      plots: [
        {
          kind: 'line',
          title: 'deadline',
          series: [
            {
              role: 'out',
              y: pks.map((p) => (p.arrivalMs === null ? NaN : p.arrivalMs - p.sentMs)),
              style: 'dots',
            },
            { role: 'error', y: pks.map(() => offset) },
          ],
          yLabel: 'ms',
        },
      ],
    };
  },
});

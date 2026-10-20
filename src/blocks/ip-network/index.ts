import { defineBlock } from '@/engine/types';
import { gaussian, seededRandom } from '../_shared/random';

export default defineBlock({
  id: 'ip-network',
  category: 'canal',
  icon: '🌐',
  inputs: { in: { type: 'packets' } },
  outputs: { out: { type: 'packets' } },
  params: {
    lossPct: { type: 'number', default: 3, min: 0, max: 40, step: 0.5, unit: '%' },
    lossModel: { type: 'select', default: 'random', options: ['random', 'bursty'] },
    burstLength: {
      type: 'number',
      default: 3,
      min: 1.5,
      max: 10,
      step: 0.5,
      unit: 'paq.',
      visibleIf: { param: 'lossModel', equals: ['bursty'] },
    },
    delayMs: { type: 'number', default: 50, min: 0, max: 400, step: 5, unit: 'ms' },
    jitterMs: { type: 'number', default: 15, min: 0, max: 150, step: 1, unit: 'ms' },
    seed: { type: 'number', default: 1, min: 1, max: 999, step: 1 },
  },
  process({ inputs, params }) {
    const rand = seededRandom(params.seed);
    const p = params.lossPct / 100;
    // Modelo de Gilbert: dos estados (bueno/malo). En el malo se pierde todo;
    // la longitud media de las ráfagas es 1/r y la tasa media de pérdidas, p.
    const r = 1 / params.burstLength;
    const q = p < 1 ? (p * r) / (1 - p) : 1;
    let bad = false;
    let lost = 0;
    let delaySum = 0;
    let delaySq = 0;
    let received = 0;
    const packets = inputs.in.packets.map((pk) => {
      if (pk.arrivalMs === null) return pk;
      let drop: boolean;
      if (params.lossModel === 'random') drop = rand() < p;
      else {
        bad = bad ? rand() >= r : rand() < q;
        drop = bad;
      }
      if (drop) {
        lost++;
        return { ...pk, arrivalMs: null, lostReason: 'network' as const };
      }
      // Retardo = propagación fija + cola variable (siempre positiva).
      const d = params.delayMs + Math.abs(gaussian(rand)) * params.jitterMs;
      delaySum += d;
      delaySq += d * d;
      received++;
      return { ...pk, arrivalMs: pk.arrivalMs + d };
    });
    const mean = received ? delaySum / received : 0;
    const std = received ? Math.sqrt(Math.max(0, delaySq / received - mean * mean)) : 0;
    return {
      outputs: { out: { ...inputs.in, packets } },
      metrics: [
        {
          key: 'lostPct',
          value: (100 * lost) / Math.max(1, packets.length),
          unit: '%',
          highlight: true,
        },
        { key: 'meanDelay', value: mean, unit: 'ms', highlight: true },
        { key: 'jitter', value: std, unit: 'ms' },
        { key: 'lost', value: lost, unit: 'paq.' },
      ],
      latencyMs: params.delayMs,
      plots: [
        {
          kind: 'line',
          title: 'delay',
          series: [
            {
              role: 'out',
              y: packets.map((pk, i) =>
                pk.arrivalMs === null ? NaN : pk.arrivalMs - inputs.in.packets[i].arrivalMs!,
              ),
              style: 'dots',
            },
            {
              role: 'error',
              y: packets.map((pk) => (pk.arrivalMs === null ? 0 : NaN)),
              style: 'dots',
            },
          ],
          yLabel: 'ms',
        },
      ],
    };
  },
});

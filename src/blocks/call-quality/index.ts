import { defineBlock } from '@/engine/types';
import { CODECS, guessCodec, mosFromR, rFactor, satisfaction, type CodecId } from './emodel';

export default defineBlock({
  id: 'call-quality',
  category: 'salida',
  icon: '📞',
  inputs: { in: { type: 'packets' } },
  outputs: {},
  params: {
    codec: {
      type: 'select',
      default: 'auto',
      options: ['auto', ...(Object.keys(CODECS) as CodecId[])],
    },
    burstR: { type: 'number', default: 1, min: 1, max: 4, step: 0.1 },
    extraDelayMs: { type: 'number', default: 20, min: 0, max: 200, step: 5, unit: 'ms' },
  },
  process({ inputs, params, inputLatencyMs }) {
    const pks = inputs.in.packets;
    const ppl = (100 * pks.filter((p) => p.arrivalMs === null).length) / Math.max(1, pks.length);
    const ta = (inputLatencyMs?.in ?? 0) + params.extraDelayMs;
    const codec = params.codec === 'auto' ? guessCodec(inputs.in.payload.header) : params.codec;
    const { ie, bpl } = CODECS[codec];
    const r = rFactor(ta, ie, bpl, ppl, params.burstR);
    const mos = mosFromR(r);
    // R frente al retardo, con este códec y estas pérdidas.
    const delays = Array.from({ length: 101 }, (_, i) => i * 5);
    return {
      outputs: {},
      metrics: [
        { key: 'mos', value: mos, highlight: true },
        { key: 'r', value: r, highlight: true },
        { key: 'delay', value: ta, unit: 'ms' },
        { key: 'loss', value: ppl, unit: '%' },
        { key: 'ie', value: ie },
      ],
      plots: [
        {
          kind: 'line',
          title: `sat-${satisfaction(r)}`,
          series: [
            { role: 'aux', x: delays, y: delays.map(() => 70) },
            {
              role: 'out',
              x: delays,
              y: delays.map((d) => rFactor(d, ie, bpl, ppl, params.burstR)),
            },
            { role: 'error', x: [ta], y: [r], style: 'dots' },
          ],
          xLabel: 'retardo (ms)',
          yLabel: 'R',
          yRange: [0, 100],
        },
      ],
    };
  },
});

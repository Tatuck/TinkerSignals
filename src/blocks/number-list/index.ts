import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

/**
 * Unas pocas muestras escritas a mano, como las de un ejercicio:
 * «150, 160, 162…» o «4,3 −2,6 5,7». Se dividen por el fondo de escala para
 * que queden en [−1, 1], que es lo que esperan los cuantizadores y códecs.
 */
export default defineBlock({
  id: 'number-list',
  category: 'entrada',
  icon: '✏️',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: {
    values: { type: 'text', default: '0.1, 0.09, -0.05, -0.15, -0.5, 0.8, 0.3', maxLength: 2000 },
    fullScale: { type: 'number', default: 1, min: 0.001, max: 100000, step: 0.001, scale: 'log' },
    sampleRate: { type: 'number', default: 8000, min: 1, max: 96000, step: 1, unit: 'Hz' },
  },
  process({ params }) {
    const values = parseValues(params.values);
    if (!values.length)
      throw new Error('Escribe al menos un número, separados por comas o espacios.');
    const fs = params.fullScale;
    const x = Float32Array.from(values, (v) => Math.max(-1, Math.min(1, v / fs)));
    const clipped = values.filter((v) => Math.abs(v) > fs).length;
    return {
      outputs: { out: makeSignal(x, params.sampleRate) },
      metrics: [
        { key: 'count', value: values.length, highlight: true },
        { key: 'clipped', value: clipped },
      ],
      plots: [
        {
          kind: 'table',
          title: 'values',
          columns: ['$n$', 'Valor', 'Normalizado'],
          rows: values.map((v, n) => [n, v, x[n]]),
          notes: [`Normalizado = valor / ${fs} (fondo de escala), recortado a $[-1, 1]$.`],
        },
      ],
    };
  },
});

/**
 * Números separados por comas, punto y coma o espacios. Admite coma decimal
 * («4,3») cuando los números van separados por espacios o punto y coma, y el
 * signo menos tipográfico.
 */
export function parseValues(text: string): number[] {
  const t = text.replace(/[−–]/g, '-').trim();
  // Con «;» o con espacios entre números, la coma es decimal; si no, separa.
  const decimalComma = /;/.test(t) || /\d,\d+\s+-?\d/.test(t) || /^-?\d+,\d+$/.test(t);
  const parts = decimalComma ? t.split(/[;\s]+/) : t.split(/[,;\s]+/);
  return parts
    .map((p) => Number(decimalComma ? p.replace(',', '.') : p))
    .filter((v, i) => parts[i] !== '' && Number.isFinite(v));
}

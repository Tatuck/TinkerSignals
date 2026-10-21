import { makeBitstream } from '@/engine/dsp/bitstream';
import { BitWriter } from '@/engine/dsp/bits';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'text-source',
  category: 'utilidades',
  icon: '✉️',
  inputs: {},
  outputs: { out: { type: 'bitstream' } },
  params: {
    text: {
      type: 'text',
      default: 'Nos vemos en la biblioteca a las cinco.',
      maxLength: 2000,
      multiline: true,
    },
    encoding: { type: 'select', default: 'utf-8', options: ['utf-8', 'ascii'] },
  },
  process({ params }) {
    const ascii = params.encoding === 'ascii';
    const chars = [...params.text];
    const bytes = ascii
      ? chars.map((c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63))
      : [...new TextEncoder().encode(params.text)];
    const bits = ascii ? 7 : 8;
    const w = new BitWriter();
    for (const b of bytes) w.write(b, bits);
    const out = makeBitstream(
      w,
      {
        codec: 'text',
        sampleRate: 0,
        numSamples: 0,
        encoding: params.encoding,
        symbolBits: bits,
        unit: { name: 'carácter', count: chars.length },
      },
      chars.length * 8,
    );
    // Entropía de la fuente: el mínimo de bits por símbolo que puede alcanzar
    // un código sin pérdidas que codifique cada símbolo por separado.
    const freq = new Map<number, number>();
    for (const b of bytes) freq.set(b, (freq.get(b) ?? 0) + 1);
    let h = 0;
    for (const f of freq.values()) {
      const p = f / Math.max(1, bytes.length);
      h -= p * Math.log2(p);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
    return {
      outputs: { out },
      metrics: [
        { key: 'characters', value: chars.length, highlight: true },
        { key: 'entropy', value: h, unit: 'bits', highlight: true },
        { key: 'symbols', value: freq.size },
      ],
      plots: [
        {
          kind: 'bars',
          title: 'freq',
          values: top.map(([, f]) => f),
          labels: top.map(([c, f]) => `«${c === 32 ? '␣' : String.fromCharCode(c)}»: ${f} veces`),
        },
      ],
    };
  },
});

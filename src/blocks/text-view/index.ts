import { expectCodec } from '@/engine/dsp/bitstream';
import { BitReader } from '@/engine/dsp/bits';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'text-view',
  category: 'salida',
  icon: '📜',
  inputs: { in: { type: 'bitstream' } },
  outputs: {},
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'text', 'El visor de texto');
    const bits = b.header.encoding === 'ascii' ? 7 : 8;
    const r = new BitReader(b.bytes, b.bitLength);
    const bytes = Uint8Array.from({ length: Math.floor(b.bitLength / bits) }, () => r.read(bits));
    const text =
      bits === 7 ? String.fromCharCode(...bytes) : new TextDecoder('utf-8').decode(bytes);
    const bad = [...text].filter((c) => c === '�' || (c < ' ' && c !== '\n')).length;
    return {
      outputs: {},
      metrics: [
        { key: 'characters', value: [...text].length, highlight: true },
        { key: 'unreadable', value: bad, highlight: bad > 0 },
      ],
      plots: [{ kind: 'text', title: 'text', text }],
    };
  },
});

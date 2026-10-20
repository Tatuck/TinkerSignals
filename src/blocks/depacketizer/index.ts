import { BitWriter } from '@/engine/dsp/bits';
import { compress, type Law } from '@/engine/dsp/companding';
import { uniformIndex } from '@/engine/dsp/quantize';
import { defineBlock, type Bitstream } from '@/engine/types';

export default defineBlock({
  id: 'depacketizer',
  category: 'canal',
  family: 'voip',
  familyRole: 'decoder',
  icon: '📦',
  inputs: { in: { type: 'packets' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    concealment: { type: 'select', default: 'repeat', options: ['repeat', 'silence'] },
  },
  process({ inputs, params }) {
    const { payload, packets, packetMs } = inputs.in;
    const w = new BitWriter();
    const silence = silenceWriter(payload);
    let prev: { start: number; bits: number } | null = null;
    let concealed = 0;

    for (const p of packets) {
      if (p.arrivalMs !== null) {
        copy(payload, p.startBit, p.payloadBits, w);
        prev = { start: p.startBit, bits: p.payloadBits };
        continue;
      }
      concealed++;
      // Ocultación de pérdidas: repetir el último paquete bueno, o rellenar con silencio.
      if (params.concealment === 'repeat' && prev) copyFit(payload, prev, p.payloadBits, w);
      else silence(w, p.payloadBits);
    }
    const { bytes, bitLength } = w.finish();
    const out: Bitstream = { ...payload, bytes, bitLength };
    return {
      outputs: { out },
      metrics: [
        { key: 'concealedPct', value: (100 * concealed) / Math.max(1, packets.length), unit: '%', highlight: true },
        { key: 'concealedMs', value: concealed * packetMs, unit: 'ms', highlight: true },
        { key: 'concealed', value: concealed, unit: 'paq.' },
      ],
    };
  },
});

/** Copia `bits` bits desde la posición `start` (acceso directo a los bytes, sin recorrer desde el principio). */
function copy(b: Bitstream, start: number, bits: number, w: BitWriter) {
  for (let i = start; i < start + bits; i++) {
    w.writeBit(i < b.bitLength ? (b.bytes[i >> 3] >> (7 - (i & 7))) & 1 : 0);
  }
}

/** Copia el paquete anterior ajustándolo al tamaño del perdido (pueden diferir en un bit). */
function copyFit(b: Bitstream, prev: { start: number; bits: number }, bits: number, w: BitWriter) {
  copy(b, prev.start, Math.min(prev.bits, bits), w);
  for (let i = prev.bits; i < bits; i++) w.writeBit(0);
}

/**
 * Qué bits suenan a silencio depende del códec. Para PCM es el código del
 * nivel 0; para el resto se usan ceros, que en la mayoría de códecs
 * diferenciales y paramétricos equivalen a "sin cambios" o ganancia mínima.
 */
function silenceWriter(b: Bitstream): (w: BitWriter, bits: number) => void {
  const h = b.header as Record<string, unknown>;
  if (h.codec === 'pcm') {
    const n = h.bits as number;
    const code = uniformIndex(compress(0, h.law as Law, h.mu as number), n, 'midrise');
    return (w, bits) => {
      for (let i = 0; i + n <= bits; i += n) w.write(code, n);
      for (let i = bits - (bits % n); i < bits; i++) w.writeBit(0);
    };
  }
  return (w, bits) => {
    for (let i = 0; i < bits; i++) w.writeBit(0);
  };
}

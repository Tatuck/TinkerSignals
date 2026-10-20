import { defineBlock, type Packet } from '@/engine/types';

/** Bytes de cabecera por paquete según la pila de protocolos. */
const STACKS = {
  'rtp-udp-ipv4': { bytes: 12 + 8 + 20, label: 'RTP/UDP/IPv4' },
  'rtp-udp-ipv6': { bytes: 12 + 8 + 40, label: 'RTP/UDP/IPv6' },
  'rtp-udp-ipv4-eth': { bytes: 12 + 8 + 20 + 38, label: 'RTP/UDP/IPv4/Ethernet' },
  crtp: { bytes: 4, label: 'RTP comprimido (cRTP)' },
} as const;
const BREAKDOWN: Record<keyof typeof STACKS, [string, number][]> = {
  'rtp-udp-ipv4': [
    ['RTP', 12],
    ['UDP', 8],
    ['IPv4', 20],
  ],
  'rtp-udp-ipv6': [
    ['RTP', 12],
    ['UDP', 8],
    ['IPv6', 40],
  ],
  'rtp-udp-ipv4-eth': [
    ['RTP', 12],
    ['UDP', 8],
    ['IPv4', 20],
    ['Ethernet', 38],
  ],
  crtp: [['cRTP', 4]],
};

export default defineBlock({
  id: 'packetizer',
  category: 'canal',
  family: 'voip',
  familyRole: 'encoder',
  icon: '📦',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'packets' } },
  params: {
    packetMs: { type: 'number', default: 20, min: 5, max: 120, step: 5, unit: 'ms' },
    stack: {
      type: 'select',
      default: 'rtp-udp-ipv4',
      options: Object.keys(STACKS) as (keyof typeof STACKS)[],
    },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const durationMs = (b.header.numSamples / b.header.sampleRate) * 1000;
    const count = Math.max(1, Math.ceil(durationMs / params.packetMs));
    const packets: Packet[] = [];
    for (let i = 0; i < count; i++) {
      // Reparte los bits de forma proporcional al tiempo (redondeando a bits enteros).
      const start = Math.round((b.bitLength * i) / count);
      const end = Math.round((b.bitLength * (i + 1)) / count);
      const sentMs = (i + 1) * params.packetMs; // sale cuando ya tiene todo su audio
      packets.push({
        seq: i,
        sentMs,
        arrivalMs: sentMs,
        startBit: start,
        payloadBits: end - start,
      });
    }
    const stack = STACKS[params.stack];
    const overheadBits = stack.bytes * 8;
    const pps = 1000 / params.packetMs;
    const payloadBits = b.bitLength / count;
    const payloadRate = payloadBits * pps;
    const networkRate = (payloadBits + overheadBits) * pps;
    return {
      outputs: {
        out: {
          kind: 'packets',
          payload: b,
          packets,
          packetMs: params.packetMs,
          overheadBits,
          protocol: stack.label,
        },
      },
      metrics: [
        { key: 'networkBitrate', value: networkRate, unit: 'bps', highlight: true },
        {
          key: 'overhead',
          value: (100 * overheadBits) / (payloadBits + overheadBits),
          unit: '%',
          highlight: true,
        },
        { key: 'bitrate', value: payloadRate, unit: 'bps' },
        { key: 'pps', value: pps, unit: 'paq/s' },
        { key: 'payloadBytes', value: payloadBits / 8, unit: 'B' },
      ],
      // Hay que esperar a reunir el audio de todo el paquete antes de enviarlo.
      latencyMs: params.packetMs,
      plots: [
        {
          kind: 'bars',
          title: 'packet',
          values: [payloadBits / 8, ...BREAKDOWN[params.stack].map(([, v]) => v)],
          labels: [
            `Audio: ${Math.round(payloadBits / 8)} B`,
            ...BREAKDOWN[params.stack].map(([k, v]) => `${k}: ${v} B`),
          ],
          highlight: [0],
        },
      ],
    };
  },
});

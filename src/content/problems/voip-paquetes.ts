import { pick, tex } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  codec: string;
  kbps: number;
  ptime: number;
}

const CODECS = [
  { codec: 'G.711', kbps: 64, ptimes: [10, 20, 30] },
  { codec: 'G.729', kbps: 8, ptimes: [10, 20, 30, 40] },
  { codec: 'G.723.1', kbps: 6.3, ptimes: [30, 60] },
  { codec: 'GSM FR', kbps: 13, ptimes: [20, 40] },
];
/** Cabeceras IP (20) + UDP (8) + RTP (12). */
const HEADER = 40;

const payload = (d: Data) => (d.kbps * d.ptime) / 8;
const pps = (d: Data) => 1000 / d.ptime;
const total = (d: Data) => ((payload(d) + HEADER) * 8 * pps(d)) / 1000;

export default defineProblem<Data>({
  id: 'voip-paquetes',
  title: 'Ancho de banda real de una llamada VoIP',
  topic: 'red',
  level: 'basico',
  audience: ['estudiar', 'probar'],
  order: 50,
  tags: ['VoIP', 'RTP', 'UDP', 'IP', 'cabeceras', 'paquetes por segundo', 'ancho de banda'],
  generate(rand) {
    const c = pick(rand, CODECS);
    return { codec: c.codec, kbps: c.kbps, ptime: pick(rand, c.ptimes) };
  },
  statement: (d) =>
    `Una llamada usa el códec **${d.codec}** ($${tex(d.kbps)}$ kbps) y mete **${d.ptime} ms** de voz en cada paquete. Cada paquete lleva además las cabeceras RTP (12 bytes), UDP (8) e IP (20); no cuentes la capa de enlace.\n\nCalcula la carga útil de cada paquete, los paquetes por segundo y el ancho de banda total en un sentido.`,
  answers: [
    {
      key: 'payload',
      label: 'Carga útil por paquete',
      unit: 'bytes',
      tolerance: 0.1,
      solve: payload,
    },
    { key: 'pps', label: 'Paquetes por segundo', tolerance: 0.1, solve: pps },
    { key: 'total', label: 'Ancho de banda total', unit: 'kbps', tolerance: 0.1, solve: total },
    {
      key: 'overhead',
      label: 'Parte que se va en cabeceras',
      unit: '%',
      tolerance: 0.5,
      solve: (d) => (100 * HEADER) / (payload(d) + HEADER),
    },
  ],
  hints: () => [
    'Carga útil: $\\text{tasa} \\cdot \\text{duración del paquete} / 8$ bytes.',
    'Cada paquete suma 40 bytes de cabecera. Multiplica el tamaño total en bits por los paquetes por segundo.',
  ],
  explain: (d) =>
    `Carga útil $= ${tex(d.kbps)}\\ \\text{kbps} \\cdot ${d.ptime}\\ \\text{ms} / 8 = ${tex(payload(d), 2)}$ bytes; $${tex(pps(d), 2)}$ paquetes/s; total $= (${tex(payload(d), 2)} + 40) \\cdot 8 \\cdot ${tex(pps(d), 2)} = ${tex(total(d), 2)}$ kbps.\n\nCon códecs de baja tasa las cabeceras pesan más que la voz. Meter más ms por paquete ahorra cabeceras, pero suma retardo (la voz espera a que se llene el paquete) y cada pérdida se lleva más audio.`,
});

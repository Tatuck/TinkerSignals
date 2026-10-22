import { int, pick } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  voice: number;
  signaling: number;
  fs: number;
  bits: number;
}

export default defineProblem<Data>({
  id: 'tasa-multiplex',
  title: 'Tasa de bits de un múltiplex telefónico',
  topic: 'muestreo',
  level: 'basico',
  audience: ['estudiar'],
  order: 50,
  tags: ['bitrate', 'tasa binaria', 'TDM', 'E1', 'PCM'],
  generate: (rand) => ({
    voice: pick(rand, [24, 30, 30, 32, 48, 60]),
    signaling: int(rand, 1, 3),
    fs: 8000,
    bits: pick(rand, [7, 8, 8]),
  }),
  statement: (d) =>
    `Una trama telefónica junta **${d.voice} canales de voz** y **${d.signaling} de señalización**, que tienen la misma tasa que los de voz. Cada canal se muestrea a $f_s = ${d.fs / 1000}$ kHz con **${d.bits} bits por muestra**.\n\n¿Qué tasa de bits lleva un canal? ¿Y la señal completa?`,
  answers: [
    {
      key: 'channel',
      label: 'Tasa de un canal',
      unit: 'kbps',
      solve: (d) => (d.fs * d.bits) / 1000,
    },
    {
      key: 'total',
      label: 'Tasa de toda la trama',
      unit: 'kbps',
      solve: (d) => ((d.voice + d.signaling) * d.fs * d.bits) / 1000,
    },
  ],
  hints: (d) => [
    'Cada canal envía $f_s$ muestras por segundo y cada muestra ocupa $n$ bits: $R = f_s \\cdot n$.',
    `Los de señalización cuentan igual que los de voz: hay ${d.voice} + ${d.signaling} = ${d.voice + d.signaling} canales.`,
  ],
  explain: (d) =>
    `Un canal: $R = f_s \\cdot n = ${d.fs} \\cdot ${d.bits} = ${d.fs * d.bits}$ bit/s.\n\nToda la trama: $R_T = ${d.voice + d.signaling} \\cdot ${d.fs * d.bits} = ${(d.voice + d.signaling) * d.fs * d.bits}$ bit/s $= ${((d.voice + d.signaling) * d.fs * d.bits) / 1000}$ kbps.${d.voice === 30 && d.signaling === 2 && d.bits === 8 ? ' Es la trama E1 europea: 2048 kbps.' : ''}`,
});

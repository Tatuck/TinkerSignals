import { GAIN_BITS, lpcConfig } from '@/blocks/_shared/lpc-vocoder';
import { pick, tex } from '../problemKit';
import { defineProblem, type Circuit } from '../types';

interface Data {
  fs: number;
  order: number;
  kBits: number;
  frameMs: number;
}

const config = (d: Data) => lpcConfig(d.fs, d.frameMs, d.order, d.kBits);

export default defineProblem<Data>({
  id: 'vocoder-bits',
  title: 'Bits por trama de un vocoder LPC',
  topic: 'voz',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 50,
  tags: ['LPC', 'vocoder', 'bits por trama', 'pitch', 'ganancia', 'sonora', 'sorda', 'bitrate'],
  generate: (rand) => ({
    fs: pick(rand, [8000, 16000]),
    order: pick(rand, [8, 10, 12]),
    kBits: pick(rand, [4, 5, 6]),
    frameMs: pick(rand, [10, 20, 25, 30]),
  }),
  statement: (d) => {
    const c = config(d);
    return `Un vocoder LPC trabaja con voz muestreada a $${d.fs / 1000}$ kHz en tramas de **${d.frameMs} ms**. En cada trama envía:\n\n- **1 bit** sonora/sorda,\n- el **pitch** con ${c.pitchBits} bits (periodos de $f_s/400$ a $f_s/60$ muestras),\n- la **ganancia** con ${GAIN_BITS} bits,\n- **${d.order} coeficientes** de reflexión $k_i$ con ${d.kBits} bits cada uno.\n\n¿Cuántos bits ocupa una trama? ¿Qué tasa de bits sale? ¿Cuánto comprime frente a PCM de 16 bits?`;
  },
  circuit: (d): Circuit => ({
    nodes: [
      {
        id: 'gen',
        type: 'generator',
        x: 0,
        y: 40,
        params: { waveform: 'vowel', sampleRate: String(d.fs), duration: 1 },
      },
      {
        id: 'lpc',
        type: 'lpc-encoder',
        x: 360,
        y: 40,
        params: { order: d.order, kBits: d.kBits, frameMs: d.frameMs },
      },
    ],
    edges: [['gen', 'out', 'lpc', 'in']],
  }),
  answers: [
    {
      key: 'frame',
      label: 'Bits por trama',
      tolerance: 0,
      solve: (_, r) => r.metric('lpc', 'bitsPerFrame'),
    },
    {
      key: 'rate',
      label: 'Tasa de bits',
      unit: 'bps',
      tolerance: 1,
      solve: (_, r) => r.metric('lpc', 'bitrate'),
    },
    {
      key: 'cr',
      label: 'Compresión frente a PCM de 16 bits',
      unit: '×',
      tolerance: 0.1,
      solve: (d, r) => {
        const rate = r.metric('lpc', 'bitrate');
        return rate ? (16 * d.fs) / rate : undefined;
      },
    },
  ],
  hints: (d) => [
    `Suma los campos: $1 + \\text{pitch} + \\text{ganancia} + ${d.order} \\cdot ${d.kBits}$.`,
    `Hay $1000 / ${d.frameMs} = ${tex(1000 / d.frameMs, 2)}$ tramas por segundo.`,
    `PCM de 16 bits a ${d.fs / 1000} kHz son $${16 * d.fs}$ bit/s.`,
  ],
  explain: (d, r) => {
    const bits = r.metric('lpc', 'bitsPerFrame') ?? 0;
    const share = Math.round((100 * d.order * d.kBits) / Math.max(1, bits));
    return `Los coeficientes se llevan el ${share} % de cada trama: son la forma del tracto vocal. El resto describe la excitación con solo tres números (¿vibran las cuerdas?, ¿a qué ritmo?, ¿con cuánta fuerza?). Abre el circuito en el laboratorio y mira el cable de salida: «Qué dicen los bits» enseña cada campo de cada trama.`;
  },
});

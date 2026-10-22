import { int, pick, tex } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  amplitude: number;
  omega: number;
  bits: number;
  target: number;
}

const snrOf = (n: number) => 6.02 * n + 1.76;

export default defineProblem<Data>({
  id: 'snr-bits',
  title: 'SNR de cuantización y bits necesarios',
  topic: 'calidad',
  level: 'basico',
  audience: ['estudiar'],
  order: 50,
  tags: ['SNR', 'bits', 'cuantización', 'dB'],
  generate: (rand) => ({
    amplitude: int(rand, 1, 9),
    omega: pick(rand, [300, 500, 1000, 2000]),
    bits: int(rand, 6, 14),
    target: pick(rand, [30, 40, 45, 50, 60, 70, 80, 90]),
  }),
  statement: (d) =>
    `Una señal de audio vale aproximadamente $s(t) = ${d.amplitude}\\cos(${d.omega}t)$ y se cuantiza con PCM lineal que cubre justo su rango, de $-${d.amplitude}$ a $${d.amplitude}$ V.\n\n1. ¿Qué relación señal-ruido de cuantización da con **${d.bits} bits**?\n2. ¿Cuántos bits hacen falta como mínimo para llegar a **${d.target} dB**?`,
  answers: [
    {
      key: 'snr',
      label: 'SNR con los bits del enunciado',
      unit: 'dB',
      tolerance: 0.1,
      solve: (d) => snrOf(d.bits),
    },
    {
      key: 'bits',
      label: 'Bits necesarios',
      tolerance: 0,
      solve: (d) => Math.ceil((d.target - 1.76) / 6.02),
    },
  ],
  hints: () => [
    'La amplitud y la frecuencia no importan: si el cuantizador cubre justo el rango de la sinusoide, la SNR solo depende de los bits.',
    'Potencia de la sinusoide $A^2/2$; ruido de cuantización $\\Delta^2/12$ con $\\Delta = 2A/2^n$. Sale $\\mathrm{SNR} = 6{,}02\\,n + 1{,}76$ dB.',
    'Despeja $n$ y redondea hacia arriba: un bit de menos no llega.',
  ],
  explain: (d) => {
    const n = Math.ceil((d.target - 1.76) / 6.02);
    return `$\\mathrm{SNR} = 10\\log_{10}\\dfrac{A^2/2}{\\Delta^2/12} = 6{,}02 \\cdot ${d.bits} + 1{,}76 = ${tex(snrOf(d.bits), 2)}$ dB.\n\nPara ${d.target} dB: $n \\geq \\dfrac{${d.target} - 1{,}76}{6{,}02} = ${tex((d.target - 1.76) / 6.02, 2)}$, así que hacen falta **${n} bits** (con ${n} bits se llega a ${tex(snrOf(n), 2)} dB).`;
  },
});

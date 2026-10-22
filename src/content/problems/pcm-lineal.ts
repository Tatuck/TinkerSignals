import { pick, tex } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  /** Ancho de banda (kHz). */
  band: number;
  /** Frecuencia de muestreo (kHz). */
  fs: number;
  bits: number;
}

export default defineProblem<Data>({
  id: 'pcm-lineal',
  title: 'PCM lineal: niveles, tasa y SNR máxima',
  topic: 'cuantizacion',
  level: 'basico',
  audience: ['estudiar'],
  order: 50,
  tags: ['PCM', 'niveles', 'SNR', '6 dB por bit', 'bitrate'],
  generate(rand) {
    const band = pick(rand, [3.4, 4, 7, 15, 20]);
    const fs = pick(
      rand,
      [8, 10, 16, 32, 44.1, 48].filter((f) => f >= 2 * band),
    );
    return { band, fs, bits: pick(rand, [6, 8, 10, 12, 14, 16]) };
  },
  statement: (d) =>
    `Una señal ocupa de 0 a $${tex(d.band)}$ kHz y se transmite con **PCM lineal** de **${d.bits} bits por muestra**, muestreando a $f_s = ${tex(d.fs)}$ kHz.\n\nCalcula el número de niveles de cuantización, la tasa de bits y la relación señal-ruido máxima (con una sinusoide a fondo de escala).`,
  answers: [
    { key: 'levels', label: 'Niveles de cuantización', tolerance: 0, solve: (d) => 2 ** d.bits },
    { key: 'rate', label: 'Tasa de bits', unit: 'kbps', solve: (d) => d.fs * d.bits },
    {
      key: 'snr',
      label: 'SNR máxima',
      unit: 'dB',
      tolerance: 0.1,
      solve: (d) => 6.02 * d.bits + 1.76,
    },
  ],
  hints: (d) => [
    'Con $n$ bits hay $L = 2^n$ niveles.',
    'La tasa es $R = f_s \\cdot n$.',
    'Para una sinusoide a fondo de escala, $\\mathrm{SNR} \\approx 6{,}02\\,n + 1{,}76$ dB: cada bit más da unos 6 dB.',
    `Comprueba también Nyquist: $f_s = ${tex(d.fs)} \\geq 2 \\cdot ${tex(d.band)}$ kHz.`,
  ],
  explain: (d) =>
    `$L = 2^{${d.bits}} = ${2 ** d.bits}$ niveles.\n\n$R = f_s \\cdot n = ${tex(d.fs)} \\cdot ${d.bits} = ${tex(d.fs * d.bits)}$ kbps.\n\n$\\mathrm{SNR} = 6{,}02 \\cdot ${d.bits} + 1{,}76 = ${tex(6.02 * d.bits + 1.76, 2)}$ dB.`,
});

import { pick, tex } from '../problemKit';
import { defineProblem } from '../types';

interface Data {
  w: number;
  h: number;
  scheme: string;
}

/** Divisor horizontal y vertical de la crominancia en cada esquema. */
const SCHEMES: Record<string, [number, number]> = {
  '4:4:4': [1, 1],
  '4:2:2': [2, 1],
  '4:2:0': [2, 2],
  '4:1:1': [4, 1],
};
const chroma = (d: Data) => (d.w / SCHEMES[d.scheme][0]) * (d.h / SCHEMES[d.scheme][1]);
const bytes = (d: Data) => d.w * d.h + 2 * chroma(d);

export default defineProblem<Data>({
  id: 'croma',
  title: 'Submuestreo de la crominancia',
  topic: 'imagen',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 55,
  tags: ['YCbCr', 'croma', 'submuestreo', '4:2:0', '4:2:2', '4:1:1', 'bits por píxel'],
  generate: (rand) => {
    const [w, h] = pick(rand, [
      [320, 240],
      [640, 480],
      [1280, 720],
      [1920, 1080],
    ]);
    return { w, h, scheme: pick(rand, ['4:2:2', '4:2:0', '4:1:1', '4:4:4', '4:2:0']) };
  },
  statement: (d) =>
    `Una imagen en color de **${d.w} × ${d.h}** se pasa a $YCbCr$ con 8 bits por muestra y la crominancia se submuestrea en **${d.scheme}**.\n\n¿Cuántas muestras quedan de $Cb$? ¿Cuántos bytes ocupa la imagen sin comprimir? ¿Cuántos bits por píxel son?`,
  answers: [
    { key: 'cb', label: 'Muestras de $Cb$', tolerance: 0, solve: chroma },
    { key: 'bytes', label: 'Tamaño total', unit: 'bytes', tolerance: 0, solve: bytes },
    {
      key: 'bpp',
      label: 'Bits por píxel',
      tolerance: 0.01,
      solve: (d) => (8 * bytes(d)) / (d.w * d.h),
    },
  ],
  hints: () => [
    '4:2:2 quita la mitad de las columnas del color; 4:2:0, la mitad de filas y columnas; 4:1:1, tres de cada cuatro columnas. La luminancia $Y$ no se toca.',
    'Total = muestras de $Y$ + 2 × muestras de $Cb$ (Cr igual), a 1 byte cada una.',
  ],
  explain: (d) => {
    const [fx, fy] = SCHEMES[d.scheme];
    return `$Cb$ y $Cr$ quedan de $${d.w / fx} \\times ${d.h / fy}$. Total: $${d.w * d.h} + 2 \\cdot ${chroma(d)} = ${bytes(d)}$ bytes, o sea $${tex((8 * bytes(d)) / (d.w * d.h), 2)}$ bits por píxel frente a 24 en RGB. El ojo distingue mucho peor los detalles de color que los de brillo, por eso casi no se nota.`;
  },
});

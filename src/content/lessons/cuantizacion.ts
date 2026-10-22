import { defineLesson } from '../types';

export default defineLesson({
  id: 'cuantizacion',
  title: 'Cuantización: 6 dB por bit',
  summary: 'Cómo afecta el número de bits a la calidad, y por qué el silencio importa.',
  minutes: 4,
  example: 'cuantizacion',
  topic: 'cuantizacion',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: 'Una vocal sintética pasa por un cuantizador uniforme de 4 bits: cada muestra se redondea a uno de 16 niveles. Mira en el bloque la escalera de la salida frente a la entrada.',
      node: 'q',
    },
    {
      text: 'Sube los bits a 8.',
      node: 'q',
      param: 'bits',
      task: 'Pon 8 bits por muestra.',
      check: (c) => Number(c.param('q', 'bits')) === 8,
    },
    {
      text: 'La SNR ha subido unos 24 dB: cada bit extra divide el escalón por dos y mejora unos 6 dB. Compara la SNR medida con la teórica en el panel.',
      node: 'q',
    },
    {
      text: 'Baja ahora a 2 bits y escucha con el botón A/B de la Salida.',
      node: 'q',
      param: 'bits',
      task: 'Pon 2 bits por muestra.',
      check: (c) => Number(c.param('q', 'bits')) === 2,
    },
    {
      text: 'Con 2 bits el error ya no es un siseo: tiene la forma de la señal y se oye como distorsión. Por eso el modelo de «ruido de cuantización» solo vale con suficientes bits.',
    },
  ],
});

import { defineLesson } from '../types';

export default defineLesson({
  id: 'dentro-lpc',
  title: 'Dentro del codificador LPC',
  summary:
    'Tramas, autocorrelación y Levinson-Durbin: de dónde salen los coeficientes del filtro que imita la voz.',
  minutes: 6,
  example: 'vocoder-lpc',
  topic: 'voz',
  level: 'avanzado',
  audience: ['estudiar'],
  order: 40,
  steps: [
    {
      text: '[[El codificador LPC|n:enc]] no envía la onda: envía un **modelo** de cómo se produjo. Una excitación (pulsos si la trama es sonora, ruido si es sorda) pasa por un filtro que imita el tracto vocal.',
      node: 'enc',
      theory: 'fuente-filtro',
    },
    {
      text: 'Haz **doble clic** sobre el codificador para verlo por dentro: un troceador con ventana de Hamming, la **autocorrelación** de cada trama y **Levinson-Durbin**, que resuelve las ecuaciones normales y saca los coeficientes del predictor.',
      node: 'enc',
      theory: 'prediccion',
    },
    {
      text: 'Cada coeficiente se envía como **coeficiente de reflexión** $k_i$, que siempre está entre $-1$ y $1$: así es fácil cuantizarlo y el filtro sigue siendo estable.',
      node: 'enc',
      predict: {
        question: 'Si subes el orden del predictor de 10 a 20, ¿qué pasa con los bits por trama?',
        options: ['No cambian', 'Suben 10 veces los bits de un coeficiente', 'Se duplican'],
        answer: 1,
        explain:
          'Cada coeficiente más cuesta sus bits; el resto de la trama (sonora/sorda, pitch y ganancia) no cambia.',
      },
    },
    {
      text: 'Compruébalo.',
      node: 'enc',
      param: 'order',
      task: 'Pon el orden del predictor a 20.',
      check: (c) => Number(c.param('enc', 'order')) === 20,
    },
    {
      text: 'Mira [[los bits por trama|m:enc.bitsPerFrame]] y [[la tasa|m:enc.bitrate]]. Escucha [[la salida|n:out]]: con más orden la envolvente espectral es más fina, pero a 8 kHz un orden de 10 ya captura los formantes. Por eso los códecs de voz usan 10.',
      focus: { nodes: ['enc', 'out'] },
    },
  ],
});

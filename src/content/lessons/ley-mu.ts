import { defineLesson } from '../types';

export default defineLesson({
  id: 'ley-mu',
  title: 'Ley μ: escalones donde hacen falta',
  summary:
    'Con los mismos bits, un cuantizador no uniforme protege mucho mejor las señales débiles.',
  minutes: 5,
  example: 'ley-mu-vs-lineal',
  topic: 'cuantizacion',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 20,
  steps: [
    {
      text: 'Una vocal **muy flojita** (amplitud 0,1) pasa por dos [[codificadores PCM de 6 bits|n:lin,mu]]: arriba, lineal; abajo, con **ley μ**. Los dos gastan exactamente los mismos bits por muestra.',
      focus: { nodes: ['lin', 'mu'] },
    },
    {
      text: 'Antes de mirar [[los comparadores|n:c1,c2]], piénsalo.',
      predict: {
        question: '¿Cuál dará más SNR con esta señal tan débil?',
        options: ['El lineal', 'El de ley μ', 'Los dos igual: tienen los mismos bits'],
        answer: 1,
        explain:
          'Una señal débil solo usa los escalones del centro. El lineal tiene muy pocos ahí; la ley μ los hace finos cerca de cero y gruesos en los extremos, así que le tocan muchos más.',
      },
    },
    {
      text: 'Compara la SNR de [[la rama lineal|m:c1.snr]] con la de [[la ley μ|m:c2.snr]]. La ley μ comprime la señal antes de cuantizarla, $F(x) = \\operatorname{sgn}(x)\\,\\frac{\\ln(1+\\mu|x|)}{\\ln(1+\\mu)}$, y el decodificador la expande después.',
      theory: 'no-uniforme',
    },
    {
      text: 'Ahora una señal fuerte, que usa todo el rango.',
      node: 'gen',
      param: 'amplitude',
      task: 'Sube la amplitud del generador a 0,9 o más.',
      check: (c) => Number(c.param('gen', 'amplitude')) >= 0.9,
    },
    {
      text: 'Vuelve a comparar [[las dos SNR|m:c1.snr,c2.snr]].',
      predict: {
        question: '¿Qué ha pasado con la ventaja de la ley μ?',
        options: [
          'La ley μ sigue ganando por mucho',
          'Ahora gana la lineal',
          'Quedan exactamente iguales',
        ],
        answer: 1,
        explain:
          'Con señal fuerte el lineal aprovecha todos sus niveles y gana unos dB: la ley μ sacrifica precisión en los extremos. Pero fíjate en que la SNR de la ley μ **casi no ha cambiado**: no depende del volumen. En telefonía cada persona habla a un volumen distinto, y con ley μ todas se oyen igual de bien.',
      },
    },
    {
      text: 'En [[el codificador de ley μ|n:mu]] abre la tabla «Muestras y palabras de código»: para cada muestra verás $x$, $F(x)$, el código y lo que se reconstruye. El primer bit de cada palabra es el signo.',
      node: 'mu',
    },
  ],
});

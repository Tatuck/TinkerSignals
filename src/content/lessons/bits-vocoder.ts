import { defineLesson } from '../types';

export default defineLesson({
  id: 'bits-vocoder',
  title: 'Lo que dicen los bits de un vocoder',
  summary:
    'Sonora o sorda, pitch, ganancia y coeficientes: abre el flujo de bits y mira qué significa cada uno.',
  minutes: 5,
  example: 'vocoder-lpc',
  topic: 'voz',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear', 'probar'],
  order: 20,
  steps: [
    {
      text: 'Selecciona [[el cable de bits|e:enc>dec]] entre el codificador y el decodificador. En el panel aparece **«Qué dicen los bits»**: cada color es un campo de lo que envía el codificador.',
      focus: { edges: ['enc>dec'] },
    },
    {
      text: 'Cada trama lleva: **1 bit** sonora/sorda, el **pitch** (cada cuántas muestras vibran las cuerdas vocales), la **ganancia** (el volumen) y los **coeficientes** $k_1 \\dots k_{10}$ del filtro. Pasa por encima de cada nombre para ver qué es, y por la columna «Qué significa» para ver el valor ya traducido (el pitch en Hz, la ganancia en dB).',
      focus: { edges: ['enc>dec'] },
      predict: {
        question: '¿Qué campo se lleva más bits de cada trama?',
        options: ['El pitch', 'La ganancia', 'Los coeficientes $k_i$'],
        answer: 2,
        explain:
          'Diez coeficientes de 5 bits son 50 bits, más de lo que suma todo lo demás. Míralo en la barra de porcentajes del visor.',
      },
    },
    {
      text: 'Recorta la precisión de los coeficientes.',
      node: 'enc',
      param: 'kBits',
      task: 'Baja los bits por coeficiente a 3.',
      check: (c) => Number(c.param('enc', 'kBits')) === 3,
    },
    {
      text: 'Bajan [[los bits por trama|m:enc.bitsPerFrame]] y [[la tasa|m:enc.bitrate]]. Escucha [[la salida|n:out]].',
      predict: {
        question: '¿Cómo suena con 3 bits por coeficiente?',
        options: ['Igual que antes', 'Algo más metálico, pero se entiende', 'No se entiende nada'],
        answer: 1,
        explain:
          'El filtro es más tosco y los formantes se desplazan un poco, pero la excitación (sonora/sorda, pitch y ganancia) sigue intacta, y es lo que más ayuda a entender la voz.',
      },
    },
    {
      text: 'Mueve la **lupa temporal**: el visor de bits salta a la trama de ese instante. En una zona de silencio la trama sale sorda y con ganancia mínima.',
      focus: { edges: ['enc>dec'] },
    },
  ],
});

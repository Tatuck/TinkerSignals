import { defineLesson } from '../types';

export default defineLesson({
  id: 'analisis-voz',
  title: 'Analizar la voz: sonora, sorda y pitch',
  summary:
    'Tramas, voz sonora o sorda y frecuencia fundamental: lo que un vocoder mide antes de enviar nada.',
  minutes: 5,
  example: 'vocoder-lpc',
  topic: 'voz',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: 'La voz cambia todo el rato, pero en trozos de unos 20 ms es casi estable. [[El análisis de voz|n:va]] la corta en **tramas** y estudia cada una por separado.',
      node: 'va',
      theory: 'tramas',
    },
    {
      text: 'En cada trama decide si es **sonora** (vibran las cuerdas vocales: las vocales, la «m») o **sorda** (solo aire: la «s», la «f»). Una trama sonora es casi periódica: se parece a sí misma desplazada un periodo, y eso se ve en su autocorrelación.',
      node: 'va',
      theory: 'fuente-filtro',
    },
    {
      text: 'El generador está dando una vocal sintética.',
      node: 'gen',
      predict: {
        question: 'Si cambias la vocal por ruido, ¿cuántas tramas saldrán sonoras?',
        options: ['Casi todas', 'Casi ninguna', 'La mitad'],
        answer: 1,
        explain:
          'El ruido no se repite: su autocorrelación no tiene ningún pico fuera del cero. Para el analizador es una trama sorda, como una «s» larguísima.',
      },
    },
    {
      text: 'Compruébalo.',
      node: 'gen',
      param: 'waveform',
      task: 'Cambia la forma de onda del generador a «ruido».',
      check: (c) => c.param('gen', 'waveform') === 'noise',
    },
    {
      text: 'Mira [[el porcentaje de tramas sonoras|m:va.voicedPct]]. Ahora vuelve a la vocal y cambia el tono.',
      node: 'gen',
      param: 'frequency',
      task: 'Pon otra vez «vocal» y una frecuencia de 200 Hz.',
      check: (c) =>
        c.param('gen', 'waveform') === 'vowel' &&
        Math.abs(Number(c.param('gen', 'frequency')) - 200) < 5,
    },
    {
      text: 'El **pitch** o frecuencia fundamental $F_0$ es el ritmo al que vibran las cuerdas vocales: unos 120 Hz en una voz grave y más de 200 en una aguda. Mira [[el $F_0$ medido|m:va.f0]]. Con la lupa temporal puedes ver cada trama por separado.',
      node: 'va',
    },
  ],
});

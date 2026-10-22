import { defineLesson } from '../types';

export default defineLesson({
  id: 'perceptual',
  title: 'Lo que el oído no oye',
  summary: 'Codificación perceptual: enmascaramiento y reparto inteligente de bits.',
  minutes: 5,
  example: 'mp3-like',
  topic: 'perceptual',
  level: 'avanzado',
  audience: ['estudiar'],
  order: 20,
  steps: [
    {
      text: 'Un cuarteto de cuerda pasa por un códec perceptual tipo MPEG-1 a 128 kbps: 4 veces menos que el PCM original.',
    },
    {
      text: 'En el codificador, la gráfica superpone el espectro (gris) y el umbral de enmascaramiento (color). Lo que queda debajo del umbral no se oye, porque lo tapan los sonidos cercanos.',
      node: 'enc',
    },
    {
      text: 'Baja la tasa a 64 kbps.',
      node: 'enc',
      param: 'bitrate',
      task: 'Elige 64 kbps.',
      check: (c) => String(c.param('enc', 'bitrate')) === '64',
    },
    {
      text: 'Mira las barras de asignación: las bandas agudas se quedan sin bits. El códec sacrifica primero lo que menos se nota. Ahora desactiva el modelo psicoacústico.',
      node: 'enc',
      param: 'psychoacoustic',
      task: 'Desactiva «Modelo psicoacústico».',
      check: (c) => c.param('enc', 'psychoacoustic') === false,
    },
    {
      text: 'Sin modelo, los bits se reparten solo por energía. La SNR puede incluso subir, pero el ruido deja de quedar escondido bajo el umbral y se oye más. La SNR no mide lo que oímos.',
      node: 'out',
    },
  ],
});

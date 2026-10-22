import { defineLesson } from '../types';

export default defineLesson({
  id: 'voz',
  title: 'Voz a pocos kbps: LPC y CELP',
  summary: 'De enviar la forma de onda a enviar un modelo de la voz.',
  minutes: 6,
  example: 'celp-vs-lpc',
  topic: 'voz',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 30,
  steps: [
    {
      text: 'Arriba, CELP; abajo, un vocoder LPC. Escucha las dos Salidas. El LPC se entiende, pero suena a robot; el CELP suena mucho más natural.',
      node: 'o1',
    },
    {
      text: 'Fíjate en la SNR del Comparador de abajo: es negativa. El vocoder no copia la forma de onda, solo su envolvente espectral, así que la SNR no sirve para juzgarlo.',
      node: 'c2',
    },
    {
      text: 'Reduce el codebook del CELP a 16 vectores.',
      node: 'cenc',
      param: 'codebookSize',
      task: 'Elige 16 en «Tamaño del codebook».',
      check: (c) => String(c.param('cenc', 'codebookSize')) === '16',
    },
    {
      text: 'Baja la tasa, y normalmente también la SNR segmental: hay menos excitaciones entre las que elegir. Ahora desactiva el libro adaptativo.',
      node: 'cenc',
      param: 'adaptive',
      task: 'Desactiva «Libro adaptativo».',
      check: (c) => c.param('cenc', 'adaptive') === false,
    },
    {
      text: 'Sin libro adaptativo, CELP pierde el tono (la periodicidad de las vocales) y la calidad cae mucho. Esa memoria de la excitación pasada es la clave de los códecs de voz modernos.',
    },
  ],
});

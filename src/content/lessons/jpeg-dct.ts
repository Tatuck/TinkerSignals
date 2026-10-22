import { defineLesson } from '../types';

export default defineLesson({
  id: 'jpeg-dct',
  title: 'JPEG (2): DCT y cuantización',
  summary:
    'La DCT concentra la imagen en pocos coeficientes; el cuantizador es quien de verdad tira información.',
  minutes: 5,
  example: 'jpeg-paso-a-paso',
  topic: 'imagen',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 20,
  steps: [
    {
      text: '[[La DCT 2D|n:dct]] trabaja con bloques de 8 × 8 píxeles y los escribe como suma de 64 patrones, del más liso (la DC, arriba a la izquierda) al más rayado. Mira [[cuánta energía queda en las frecuencias bajas|m:dct.lowEnergy]].',
      node: 'dct',
      theory: 'dct-2d',
    },
    {
      text: 'Una imagen natural es lisa casi en todas partes, así que casi todo cae en unos pocos coeficientes.',
      node: 'dct',
      predict: {
        question: 'La DCT, ¿pierde información?',
        options: ['Sí, por eso JPEG pierde calidad', 'No: es invertible'],
        answer: 1,
        explain:
          'La DCT solo cambia de base: con la inversa se recuperan los píxeles exactos. Lo que pierde información es el paso siguiente.',
      },
    },
    {
      text: '[[El cuantizador|n:q]] divide cada coeficiente por un paso de una tabla y redondea: $F_q = \\operatorname{round}(F / Q)$. Los pasos son pequeños en baja frecuencia y grandes en alta, así que la mayoría de los coeficientes de alta frecuencia [[acaban en cero|m:q.zeros]].',
      node: 'q',
      theory: 'jpeg',
    },
    {
      text: 'Lleva la calidad al extremo.',
      node: 'q',
      param: 'quality',
      predict: {
        question: 'Con calidad 5, ¿cómo se verá la imagen?',
        options: ['Borrosa por igual', 'Con cuadraditos de 8 × 8', 'Con los colores cambiados'],
        answer: 1,
        explain:
          'Casi cada bloque se queda solo con su DC: un cuadrado de un solo tono. Es el famoso **efecto de bloques** de JPEG.',
      },
      task: 'Baja la calidad del cuantizador a 5.',
      check: (c) => Number(c.param('q', 'quality')) <= 5,
    },
    {
      text: 'Mira la [[imagen de salida|n:cmp]] y su [[PSNR|m:cmp.psnr]]. En la siguiente lección verás cómo esos ceros se convierten en muy pocos bits.',
      node: 'cmp',
    },
  ],
});

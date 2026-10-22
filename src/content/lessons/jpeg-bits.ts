import { defineLesson } from '../types';

export default defineLesson({
  id: 'jpeg-bits',
  title: 'JPEG (3): de un bloque a los bits',
  summary:
    'Zigzag, DC diferencial, pares (ceros, categoría), EOB y Huffman, sobre un bloque de verdad.',
  minutes: 6,
  example: 'jpeg-bloque',
  topic: 'imagen',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 30,
  steps: [
    {
      text: '[[El codificador JPEG|n:enc]] hace todos los pasos de las dos lecciones anteriores y además escribe los bits. Elige qué bloque quieres ver con [[«Bloque a detallar»|p:enc.traceBlock]].',
      node: 'enc',
      param: 'traceBlock',
      theory: 'jpeg',
    },
    {
      text: 'Abre las tablas del bloque en orden: **píxeles → DCT → tabla de cuantización → cuantizado**. Fíjate en cuántos ceros quedan abajo a la derecha.',
      node: 'enc',
    },
    {
      text: 'Los coeficientes se leen en **zigzag**, de baja a alta frecuencia, para que los ceros queden juntos al final.',
      node: 'enc',
      predict: {
        question: '¿Cómo se envía el coeficiente DC?',
        options: [
          'Su valor tal cual',
          'La diferencia con la DC del bloque anterior',
          'No se envía',
        ],
        answer: 1,
        explain:
          'Bloques vecinos tienen un brillo medio parecido, así que la diferencia es pequeña y ocupa pocos bits: es un DPCM de la DC.',
      },
    },
    {
      text: 'Abre «Del bloque a los bits» y pulsa **Paso a paso**. Cada AC distinto de cero se envía como el par **(ceros delante, categoría)** con un código de Huffman, seguido de su **amplitud**. Al final, **EOB** dice «el resto son ceros».',
      node: 'enc',
    },
    {
      text: 'Compara un bloque liso con uno con detalle.',
      node: 'enc',
      param: 'traceBlock',
      task: 'Cambia el bloque a detallar (por ejemplo, al 60, que tiene más detalle que el 0 del cielo).',
      check: (c) => Number(c.param('enc', 'traceBlock')) !== 0,
    },
    {
      text: 'Un bloque liso como el del cielo cabe en unos 16 bits (¡de 512!); uno con bordes necesita muchos más. En toda la imagen: [[bits por píxel|m:enc.bpp]], y qué parte va en [[la DC|m:enc.dcShare]] y en [[los AC|m:enc.acShare]].',
      node: 'enc',
    },
  ],
});

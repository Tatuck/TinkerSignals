import { defineLesson } from '../types';

export default defineLesson({
  id: 'jpeg-color',
  title: 'JPEG (1): color y crominancia',
  summary: 'Por qué JPEG pasa a YCbCr y se atreve a tirar la mitad del color sin que se note.',
  minutes: 4,
  example: 'jpeg-paso-a-paso',
  topic: 'imagen',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: 'Este circuito es JPEG por piezas, de izquierda a derecha. El primer paso, [[el cambio de color|n:ycc]], separa el brillo ($Y$) del color ($Cb$, $Cr$). No pierde nada: es solo otra forma de escribir los mismos píxeles.',
      node: 'ycc',
      theory: 'ycbcr',
    },
    {
      text: 'El ojo ve los detalles de **brillo** mucho mejor que los de **color**. [[El submuestreo|n:sub]] aprovecha eso: en 4:2:0 guarda una muestra de color por cada bloque de 2 × 2 píxeles.',
      node: 'sub',
      predict: {
        question: 'Quitar 3 de cada 4 muestras de color, ¿cuánto empeora la imagen?',
        options: ['Muchísimo', 'Casi nada', 'Se queda en blanco y negro'],
        answer: 1,
        explain:
          'El brillo se queda entero y el ojo apenas nota que el color tiene menos detalle, pero ya hemos ahorrado [[la mitad de los datos|m:sub.saved]].',
      },
    },
    {
      text: 'Compara con no submuestrear.',
      node: 'sub',
      param: 'scheme',
      task: 'Pon el submuestreo en 4:4:4.',
      check: (c) => c.param('sub', 'scheme') === '4:4:4',
    },
    {
      text: 'La [[PSNR|m:cmp.psnr]] sube unos 3 dB, pero ahora no se ahorra nada. La PSNR cuenta igual un error de brillo que uno de color; el ojo, no. Vuelve a 4:2:0 y mira la imagen de error del comparador: lo que añade el submuestreo está en los bordes entre colores muy distintos.',
      node: 'cmp',
    },
  ],
});

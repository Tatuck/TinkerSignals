import { defineLesson } from '../types';

export default defineLesson({
  id: 'prediccion',
  title: 'Predecir para comprimir: DPCM',
  summary: 'Con los mismos bits, enviar el error de predicción da mucha más calidad.',
  minutes: 4,
  example: 'dpcm-vs-pcm',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 10,
  steps: [
    {
      text: 'Arriba, un DPCM de 4 bits; abajo, un PCM de 4 bits. Los dos gastan lo mismo. Compara la SNR de los dos Comparadores.',
      node: 'c1',
    },
    {
      text: 'El DPCM gana porque no envía la muestra, sino lo que no se pudo predecir de ella. Mira en el codificador la ganancia de predicción y la gráfica del error.',
      node: 'denc',
    },
    {
      text: 'Baja el orden del predictor a 1.',
      node: 'denc',
      param: 'order',
      task: 'Pon el orden del predictor a 1.',
      check: (c) => Number(c.param('denc', 'order')) === 1,
    },
    {
      text: 'Con una sola muestra pasada se predice peor: baja la ganancia de predicción y la SNR. Con voz, órdenes de 8 a 12 capturan bien los formantes.',
    },
  ],
});

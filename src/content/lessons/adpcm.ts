import { defineLesson } from '../types';

export default defineLesson({
  id: 'adpcm',
  title: 'ADPCM: un escalón que se adapta',
  summary:
    'La mitad de bits que PCM de 8 bits, adaptando el escalón sin enviarlo. Y qué pasa con los errores del canal.',
  minutes: 5,
  example: 'adpcm-canal',
  topic: 'prediccion',
  level: 'intermedio',
  audience: ['estudiar'],
  order: 20,
  steps: [
    {
      text: '[[El codificador ADPCM|n:enc]] envía **4 bits por muestra**: la mitad que un PCM de 8 bits. Como DPCM, cuantiza el error de predicción; pero además **adapta el tamaño del escalón** a la señal.',
      node: 'enc',
      theory: 'dpcm',
    },
    {
      text: 'Mira la gráfica del codificador: la señal y el tamaño del escalón a lo largo del tiempo.',
      node: 'enc',
      predict: {
        question: 'Si la señal de pronto sube mucho, ¿qué hace el escalón?',
        options: ['Se queda igual', 'Crece en pocas muestras', 'Se hace más pequeño'],
        answer: 1,
        explain:
          'Cuando los códigos salen grandes (el error no cabe), el escalón crece; cuando salen pequeños, encoge. El decodificador hace la misma cuenta con los códigos que recibe, así que **no hace falta enviar el escalón**.',
      },
    },
    {
      text: '[[El canal|n:ch]] cambia bits al azar: uno de cada mil (BER = 0,001).',
      node: 'ch',
      theory: 'canal',
      predict: {
        question: '¿Qué pasará en el decodificador tras un bit erróneo?',
        options: [
          'Solo falla esa muestra',
          'Falla esa muestra y el error se arrastra un rato',
          'Se para todo',
        ],
        answer: 1,
        explain:
          'El decodificador tiene memoria: la predicción y el escalón dependen de los códigos anteriores. Un código erróneo desajusta las dos cosas y el error dura hasta que se vuelven a ajustar.',
      },
    },
    {
      text: 'Pon el canal peor y escucha [[la salida|n:out]].',
      node: 'ch',
      param: 'ber',
      task: 'Sube la tasa de error del canal a 0,01.',
      check: (c) => Number(c.param('ch', 'ber')) >= 0.01,
    },
    {
      text: 'Se oyen chasquidos y la [[SNR de la salida|m:out.snr]] cae. Selecciona [[el cable que sale del canal|e:ch>dec]] y abre «Qué dicen los bits»: los bits que ha cambiado el canal salen marcados, y «Ver una trama dañada» te lleva a ellos.',
      focus: { edges: ['ch>dec'] },
    },
  ],
});

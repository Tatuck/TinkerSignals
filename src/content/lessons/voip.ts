import { defineLesson } from '../types';

export default defineLesson({
  id: 'voip',
  title: 'Una llamada por Internet',
  summary: 'Cabeceras, pérdidas, jitter y el compromiso entre calidad y retardo.',
  minutes: 6,
  example: 'voip',
  topic: 'red',
  level: 'intermedio',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: 'Esta cadena es una llamada VoIP: voz a 8 kHz, G.711 ley A (64 kbps), paquetes RTP de 20 ms, una red con pérdidas y jitter, un búfer de jitter y la reconstrucción.',
    },
    {
      text: 'Mira el paquetizador: 64 kbps de audio ocupan 80 kbps en la red. Las cabeceras RTP/UDP/IP son el 20 % de cada paquete.',
      node: 'pk',
    },
    {
      text: 'Cambia el tamaño del paquete a 60 ms.',
      node: 'pk',
      param: 'packetMs',
      task: 'Pon 60 ms en «Audio por paquete».',
      check: (c) => Number(c.param('pk', 'packetMs')) === 60,
    },
    {
      text: 'Ahora las cabeceras pesan menos, pero cada paquete tarda 60 ms en llenarse: mira el retardo total en la Salida. Además, perder un paquete es perder 60 ms de voz de golpe.',
      node: 'out',
    },
    {
      text: 'Pon el búfer de jitter a 0 ms.',
      node: 'jb',
      param: 'bufferMs',
      task: 'Pon el tamaño del búfer a 0.',
      check: (c) => Number(c.param('jb', 'bufferMs')) === 0,
    },
    {
      text: 'Muchos paquetes llegan después de su turno y se descartan (mira «Llegan tarde»). Un búfer más grande los salva a cambio de retardo.',
      node: 'jb',
    },
    {
      text: 'El bloque «Calidad de la llamada» lo resume con el modelo E de la ITU-T: una nota (MOS) de 1 a 4,5 a partir del retardo y las pérdidas. Con un 5 % de paquetes perdidos, ni el mejor búfer pasa de un MOS de 3,8.',
      node: 'mos',
    },
    {
      text: 'Baja las pérdidas de la red al 1 % y ajusta el búfer de jitter hasta que la llamada sea buena.',
      node: 'net',
      param: 'lossPct',
      task: 'Consigue un MOS de al menos 4.',
      check: (c) => (c.metric('mos', 'mos') ?? 0) >= 4,
    },
  ],
});

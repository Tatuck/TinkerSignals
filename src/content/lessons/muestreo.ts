import { defineLesson } from '../types';

export default defineLesson({
  id: 'muestreo',
  title: 'Muestreo y aliasing',
  summary: 'Por qué hay que filtrar antes de muestrear y qué pasa si no se hace.',
  minutes: 4,
  example: 'aliasing',
  topic: 'muestreo',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: 'Un generador produce un barrido: un tono que sube de 100 Hz a 8 kHz. Dos muestreadores lo bajan a 4 kHz de muestreo; el de arriba tiene el filtro antialiasing activado y el de abajo, no.',
    },
    {
      text: 'Con fs = 4 kHz solo caben frecuencias hasta 2 kHz (la línea roja del espectro). Escucha la Salida de arriba: el tono sube y, cuando llega a 2 kHz, desaparece. El filtro lo ha quitado.',
      node: 'o1',
    },
    {
      text: 'Ahora escucha la Salida de abajo. Al pasar de 2 kHz el tono no desaparece: «rebota» y vuelve a bajar. Son frecuencias falsas: aliasing. Ya no hay forma de distinguirlas de las reales.',
      node: 'o2',
    },
    {
      text: 'Sube la frecuencia de muestreo del muestreador de abajo a 16 kHz.',
      node: 'noaa',
      param: 'sampleRate',
      task: 'Pon 16.000 Hz en «Frecuencia de muestreo».',
      check: (c) => Number(c.param('noaa', 'sampleRate')) >= 16000,
    },
    {
      text: 'Con 16 kHz, fs/2 = 8 kHz y el barrido entero cabe: ya no hay aliasing aunque no haya filtro. Conclusión: o muestreas a más del doble de la frecuencia máxima (Nyquist), o filtras antes.',
    },
  ],
});

import type { ParamValue } from '@/engine/types';

/**
 * Lecciones guiadas. Cada una parte de un ejemplo y propone pasos cortos:
 * qué tocar, qué mirar y qué conclusión sacar. Si un paso tiene `check`,
 * el botón «Siguiente» se activa cuando el usuario ha hecho lo que se pide.
 */
export interface LessonContext {
  param(nodeId: string, key: string): ParamValue | undefined;
  metric(nodeId: string, key: string): number | undefined;
  hasEdge(source: string, target: string): boolean;
}

export interface LessonStep {
  text: string;
  /** Bloque que se resalta (y se selecciona) en el lienzo. */
  node?: string;
  /** Parámetro que se resalta en el panel lateral. */
  param?: string;
  check?: (c: LessonContext) => boolean;
  /** Qué hacer, si el paso espera una acción. */
  task?: string;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  example: string;
  steps: LessonStep[];
}

export const lessons: Lesson[] = [
  {
    id: 'muestreo',
    title: 'Muestreo y aliasing',
    summary: 'Por qué hay que filtrar antes de muestrear y qué pasa si no se hace.',
    minutes: 4,
    example: 'aliasing',
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
  },
  {
    id: 'cuantizacion',
    title: 'Cuantización: 6 dB por bit',
    summary: 'Cómo afecta el número de bits a la calidad, y por qué el silencio importa.',
    minutes: 4,
    example: 'cuantizacion',
    steps: [
      {
        text: 'Una vocal sintética pasa por un cuantizador uniforme de 4 bits: cada muestra se redondea a uno de 16 niveles. Mira en el bloque la escalera de la salida frente a la entrada.',
        node: 'q',
      },
      {
        text: 'Sube los bits a 8.',
        node: 'q',
        param: 'bits',
        task: 'Pon 8 bits por muestra.',
        check: (c) => Number(c.param('q', 'bits')) === 8,
      },
      {
        text: 'La SNR ha subido unos 24 dB: cada bit extra divide el escalón por dos y mejora unos 6 dB. Compara la SNR medida con la teórica en el panel.',
        node: 'q',
      },
      {
        text: 'Baja ahora a 2 bits y escucha con el botón A/B de la Salida.',
        node: 'q',
        param: 'bits',
        task: 'Pon 2 bits por muestra.',
        check: (c) => Number(c.param('q', 'bits')) === 2,
      },
      {
        text: 'Con 2 bits el error ya no es un siseo: tiene la forma de la señal y se oye como distorsión. Por eso el modelo de «ruido de cuantización» solo vale con suficientes bits.',
      },
    ],
  },
  {
    id: 'prediccion',
    title: 'Predecir para comprimir: DPCM',
    summary: 'Con los mismos bits, enviar el error de predicción da mucha más calidad.',
    minutes: 4,
    example: 'dpcm-vs-pcm',
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
  },
  {
    id: 'voz',
    title: 'Voz a pocos kbps: LPC y CELP',
    summary: 'De enviar la forma de onda a enviar un modelo de la voz.',
    minutes: 6,
    example: 'celp-vs-lpc',
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
  },
  {
    id: 'voip',
    title: 'Una llamada por Internet',
    summary: 'Cabeceras, pérdidas, jitter y el compromiso entre calidad y retardo.',
    minutes: 6,
    example: 'voip',
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
        text: 'Muchos paquetes llegan después de su turno y se descartan (mira «Llegan tarde»). Un búfer más grande los salva a cambio de retardo. Busca un valor que deje el retardo total por debajo de 150 ms con pocas pérdidas.',
        node: 'jb',
      },
    ],
  },
  {
    id: 'perceptual',
    title: 'Lo que el oído no oye',
    summary: 'Codificación perceptual: enmascaramiento y reparto inteligente de bits.',
    minutes: 5,
    example: 'mp3-like',
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
  },
];

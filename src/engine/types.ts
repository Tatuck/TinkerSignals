/**
 * Tipos centrales del motor.
 *
 * Este fichero es el "contrato" entre el motor, los bloques y la UI.
 * No importa nada de React ni del DOM: todo lo que hay aquí se puede usar
 * en Node (tests), en un Web Worker o en el hilo principal.
 */

// ─── Valores que viajan por los cables ──────────────────────────────────────

/** Señal muestreada (audio). Las muestras están normalizadas a [-1, 1]. */
export interface Signal {
  kind: 'signal';
  sampleRate: number;
  samples: Float32Array;
}

/**
 * Cabecera de un flujo de bits: lo que codificador y decodificador
 * "acuerdan" de antemano (no viaja por el canal y no se corrompe).
 */
export interface BitstreamHeader {
  /** Identificador del formato, p. ej. 'pcm', 'dpcm', 'huffman'. */
  codec: string;
  /** 0 si lo que viaja no es audio (una imagen, un texto). */
  sampleRate: number;
  numSamples: number;
  /**
   * Para lo que no es audio: qué unidad lleva el flujo y cuántas hay
   * (p. ej. 'píxel' × 65536). La UI muestra entonces bits por unidad.
   */
  unit?: { name: string; count: number };
  [extra: string]: unknown;
}

/** Flujo de bits empaquetado (MSB primero). */
export interface Bitstream {
  kind: 'bitstream';
  bytes: Uint8Array;
  bitLength: number;
  header: BitstreamHeader;
  /**
   * Bits que ocuparía la señal original en PCM lineal de 16 bits a la
   * misma frecuencia de muestreo. Sirve de referencia para el factor de
   * compresión a lo largo de toda la cadena.
   */
  referenceBits: number;
  /**
   * Qué significa cada bit (pitch, ganancia, coeficiente DC…), para
   * enseñarlo. Es solo un metadato para la interfaz: no cuenta como bits
   * ni lo corrompen los bloques de canal. Lo rellena `BitWriter` cuando el
   * codificador etiqueta lo que escribe.
   */
  layout?: BitLayout;
  /** Tramos de bits que ha estropeado el canal: [inicio, longitud]. Metadato para la interfaz. */
  damaged?: [number, number][];
}

/** Un trozo etiquetado del flujo de bits. */
export interface BitSpan {
  /** Índice en `BitLayout.fields`. */
  field: number;
  start: number;
  length: number;
  value: number;
  /** Trama a la que pertenece (−1: cabecera, antes de la primera trama). */
  frame: number;
}

/** Mapa de los campos de un flujo de bits (ver `BitWriter.write(valor, n, campo)`). */
export interface BitLayout {
  /** Claves de los campos; sus textos están en `fields` del es.json del bloque. */
  fields: string[];
  /** Bloque que escribió el flujo (lo anota el motor): de ahí salen los textos. */
  block?: string;
  /** Longitud del flujo descrito: si un bloque cambia los bits de sitio, el mapa deja de valer. */
  bitLength: number;
  /** Tramos, en orden, hasta un tope (ver `truncated`). */
  spans: BitSpan[];
  /** Bits de cada campo en todo el flujo (exactos aunque se llegue al tope). */
  totals: number[];
  /** Número de tramas. */
  frames: number;
  /** Se dejaron de guardar tramos al llegar al tope. */
  truncated: boolean;
}

/** Un paquete de red: un trozo del flujo de bits más su historia en la red. */
export interface Packet {
  seq: number;
  /** Instante en que sale del emisor (ms desde el inicio). */
  sentMs: number;
  /** Instante en que llega, o null si se ha perdido (o llegó tarde al búfer). */
  arrivalMs: number | null;
  /** Por qué falta, si falta. */
  lostReason?: 'network' | 'late';
  /** Posición y tamaño de su carga útil dentro de `payload`. */
  startBit: number;
  payloadBits: number;
}

/** Flujo de paquetes (VoIP): el flujo de bits original troceado y su viaje por la red. */
export interface PacketStream {
  kind: 'packets';
  payload: Bitstream;
  packets: Packet[];
  /** Audio que lleva cada paquete (ms). */
  packetMs: number;
  /** Bits de cabeceras por paquete (RTP + UDP + IP…). */
  overheadBits: number;
  protocol: string;
}

/**
 * Señal troceada en tramas (o en coeficientes por trama). Es lo que circula
 * entre las piezas básicas: trocear → DCT → cuantizar → DCT inversa → unir.
 */
export interface Frames {
  kind: 'frames';
  /** Qué representan los valores de cada trama. */
  domain: 'time' | 'dct' | 'spectrum' | 'subbands' | 'autocorrelation' | 'lpc' | 'smr' | 'pitch';
  /** Frecuencia de muestreo de la señal de la que salen. */
  sampleRate: number;
  /** Muestras de la señal original entre el inicio de dos tramas. */
  hop: number;
  /** Valores por trama. */
  size: number;
  /** Longitud de la señal original (para poder reconstruirla). */
  numSamples: number;
  data: Float32Array[];
  /** Ventana de análisis aplicada al trocear, si la hubo. */
  window?: 'rect' | 'hann' | 'hamming' | 'sine';
}

/** Un plano de una imagen (luminancia, un color…): valores fila a fila. */
export interface ImagePlane {
  width: number;
  height: number;
  data: Float32Array;
  /**
   * Tamaño útil cuando el plano está rellenado hasta un múltiplo del bloque
   * (coeficientes DCT): al volver a píxeles se recorta a este tamaño.
   */
  crop?: { width: number; height: number };
}

/**
 * Imagen. En el dominio de píxeles los valores van de 0 a 255; en el
 * dominio 'dct' cada bloque guarda sus coeficientes. Cada plano puede tener
 * su propio tamaño: así viaja la crominancia submuestreada (4:2:0…).
 */
export interface Image {
  kind: 'image';
  /** Tamaño de la imagen completa (el del primer plano). */
  width: number;
  height: number;
  /** 'gray': 1 plano; 'rgb' y 'ycbcr': 3 planos en ese orden. */
  color: 'gray' | 'rgb' | 'ycbcr';
  domain: 'pixels' | 'dct';
  planes: ImagePlane[];
  /** Lado de los bloques de la transformada (solo en el dominio 'dct'). */
  blockSize?: number;
}

export type PortValue = Signal | Bitstream | PacketStream | Frames | Image;
export type PortType = PortValue['kind'];

// ─── Parámetros configurables de un bloque ──────────────────────────────────

/** Muestra el parámetro solo cuando otro tiene ciertos valores (p. ej. μ solo con ley μ). */
interface ParamBase {
  visibleIf?: { param: string; equals: readonly (string | boolean)[] };
  /** No se muestra en el panel (lo fija quien monta el circuito, p. ej. un interior). */
  hidden?: boolean;
}

export interface NumberParam extends ParamBase {
  type: 'number';
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Escala del deslizador. 'log' para frecuencias, por ejemplo. */
  scale?: 'linear' | 'log';
}

export interface SelectParam<T extends string = string> extends ParamBase {
  type: 'select';
  default: T;
  options: readonly T[];
}

export interface BooleanParam extends ParamBase {
  type: 'boolean';
  default: boolean;
}

/**
 * Referencia a un audio guardado fuera del grafo (archivo cargado o
 * grabación). El valor es un id de asset o null.
 */
export interface AudioParam extends ParamBase {
  type: 'audio';
  default: null;
  /** Cómo lo presenta la UI. */
  widget: 'file' | 'record';
}

/**
 * Valor inyectado desde fuera del grafo (lo usa el motor para los circuitos
 * interiores de los bloques). No se muestra en la interfaz.
 */
export interface ExternalParam extends ParamBase {
  type: 'external';
  default: string;
}

/** Texto libre que escribe el usuario (un mensaje, una secuencia de símbolos). */
export interface TextParam extends ParamBase {
  type: 'text';
  default: string;
  maxLength: number;
  /** Área de varias líneas en vez de un campo de una línea. */
  multiline?: boolean;
}

/** Referencia a una imagen cargada por el usuario. El valor es un id de asset o null. */
export interface ImageParam extends ParamBase {
  type: 'image';
  default: null;
}

export type ParamSpec =
  NumberParam | SelectParam | BooleanParam | AudioParam | ExternalParam | TextParam | ImageParam;
export type ParamSpecs = Record<string, ParamSpec>;

/** Convierte la especificación de parámetros en el tipo de sus valores. */
export type ParamValues<P extends ParamSpecs> = {
  [K in keyof P]: P[K] extends NumberParam
    ? number
    : P[K] extends { type: 'select'; options: readonly (infer T)[] }
      ? T
      : P[K] extends BooleanParam
        ? boolean
        : P[K] extends AudioParam
          ? string | null
          : P[K] extends ExternalParam
            ? string
            : P[K] extends TextParam
              ? string
              : P[K] extends ImageParam
                ? string | null
                : never;
};

// ─── Puertos ────────────────────────────────────────────────────────────────

export interface PortSpec {
  type: PortType;
  /** Si es true, el bloque puede ejecutarse aunque este puerto no esté conectado. */
  optional?: boolean;
}

export type PortSpecs = Record<string, PortSpec>;

type ValueOf<T extends PortType> = Extract<PortValue, { kind: T }>;

export type InputValues<I extends PortSpecs> = {
  [K in keyof I]: I[K]['optional'] extends true
    ? ValueOf<I[K]['type']> | undefined
    : ValueOf<I[K]['type']>;
};

export type OutputValues<O extends PortSpecs> = { [K in keyof O]: ValueOf<O[K]['type']> };

// ─── Lo que devuelve un bloque además de sus salidas ────────────────────────

/**
 * Métrica que el nodo muestra. Las claves estándar (bitrate, compression,
 * snr, bitsPerSample, entropy, latency…) tienen etiqueta y formato comunes
 * en la UI; un bloque puede añadir las suyas con su propia traducción.
 */
export interface Metric {
  key: string;
  value: number;
  unit?: string;
  /** Las destacadas se pintan grandes en el nodo; el resto, en el inspector. */
  highlight?: boolean;
}

export type PlotRole = 'in' | 'out' | 'aux' | 'error';

export interface PlotTick {
  value: number;
  label: string;
}

export interface LineSeries {
  role: PlotRole;
  /** Valores Y. Si no hay `x`, se reparten uniformemente. */
  y: Float32Array | number[];
  x?: Float32Array | number[];
  /** Estilo del trazo. 'step' para escaleras de cuantización. */
  style?: 'line' | 'step' | 'dots';
}

/**
 * Gráfica didáctica: simple, sin ejes detallados. La idea es que se vea
 * qué hace el bloque comparando entrada y salida, no medir con precisión.
 */
export type Plot =
  | {
      kind: 'line';
      /** Clave de traducción del título (en el es.json del bloque). */
      title: string;
      series: LineSeries[];
      xLabel?: string;
      yLabel?: string;
      /** Rango fijo de Y. Si no se da, se ajusta a los datos. */
      yRange?: [number, number];
      /** Rango fijo de X (en las unidades de `x`). */
      xRange?: [number, number];
      /** Marcas de los ejes, solo en la vista detallada (en las unidades de x e y). */
      xTicks?: PlotTick[];
      yTicks?: PlotTick[];
    }
  | {
      kind: 'bars';
      title: string;
      values: number[];
      labels?: string[];
      /** Índices de barras resaltadas (p. ej. coeficientes conservados). */
      highlight?: number[];
    }
  | {
      /** Imagen ya lista para pintar (RGBA, 4 bytes por píxel). */
      kind: 'image';
      title: string;
      width: number;
      height: number;
      rgba: Uint8ClampedArray;
    }
  | {
      /** Texto tal cual (un mensaje recuperado, una tabla corta). */
      kind: 'text';
      title: string;
      text: string;
    }
  | {
      /**
       * Tabla: la traza de un algoritmo paso a paso, con las mismas columnas
       * que se usarían al hacerlo a mano. Los problemas leen sus celdas.
       */
      kind: 'table';
      title: string;
      /** Cabeceras (notación corta: «x(n)», «código»…). Admiten fórmulas `$…$`. */
      columns: string[];
      rows: (string | number)[][];
      /** Líneas bajo la tabla (totales, fórmulas). Texto enriquecido. */
      notes?: string[];
      /** La UI la revela fila a fila, como en la pizarra. */
      stepwise?: boolean;
      /** Índices de filas resaltadas. */
      highlight?: number[];
    };

export interface ProcessResult<O extends PortSpecs> {
  outputs: OutputValues<O>;
  metrics?: Metric[];
  plots?: Plot[];
  /**
   * Retardo algorítmico que añade este bloque en milisegundos: lo que hay
   * que esperar para reunir una trama/bloque de muestras + lookahead.
   * El motor lo acumula a lo largo del camino. Las señales del motor se
   * mantienen alineadas en el tiempo para poder compararlas; el retardo se
   * informa, no se aplica.
   */
  latencyMs?: number;
}

export interface ProcessContext<I extends PortSpecs, P extends ParamSpecs> {
  inputs: InputValues<I>;
  params: ParamValues<P>;
  /** Busca un audio externo (archivo o grabación) por id. */
  getAsset(id: string): Signal | undefined;
  /**
   * Busca un valor inyectado desde fuera del grafo, de cualquier tipo de
   * cable: una imagen cargada, o las entradas de un circuito interior.
   */
  getExternal(id: string): PortValue | undefined;
  /** Retardo acumulado (ms) con el que llega cada entrada. */
  inputLatencyMs?: Record<string, number>;
}

// ─── Definición de un bloque ────────────────────────────────────────────────

export type BlockCategory =
  | 'entrada'
  | 'digitalizacion'
  | 'forma-de-onda'
  | 'perceptual'
  | 'sin-perdidas'
  | 'voz'
  | 'canal'
  | 'piezas'
  | 'utilidades'
  | 'imagen'
  | 'salida';

export interface BlockDefinition<
  I extends PortSpecs = PortSpecs,
  O extends PortSpecs = PortSpecs,
  P extends ParamSpecs = ParamSpecs,
> {
  /** Identificador único. Debe coincidir con el nombre de la carpeta. */
  id: string;
  category: BlockCategory;
  /** Emoji o nombre corto de icono que la UI sabe pintar. */
  icon: string;
  /**
   * Familia opcional: los bloques con la misma familia (p. ej. el codificador
   * y el decodificador PCM) se agrupan en una sola carpeta de la paleta.
   * El orden dentro de la familia lo da `familyRole`.
   */
  family?: string;
  familyRole?: 'encoder' | 'decoder' | 'analysis';
  /** Bloques internos del motor que no aparecen en la paleta. */
  hidden?: boolean;
  /**
   * Circuito equivalente hecho con piezas básicas, para «entrar» en el
   * bloque. Es solo didáctico: el motor sigue usando `process`.
   */
  interior?: (params: ParamValues<P>, inputs: InteriorInputs) => InteriorGraph;
  /**
   * Gráficas del bloque en un instante concreto (lupa temporal): por ejemplo,
   * la envolvente LPC o el umbral de enmascaramiento de esa trama. Se llama
   * solo cuando el usuario elige un instante.
   */
  inspectAt?: (ctx: ProcessContext<I, P> & { timeS: number }) => Plot[];
  /**
   * Qué significa el valor de un campo del flujo de bits que escribe este
   * bloque (ver `BitWriter.write(valor, n, campo)`): por ejemplo, el lag del
   * pitch → «F0 ≈ 142 Hz». Lo usa el visor de bits; sin ella se enseña el número.
   */
  describeField?: (field: string, value: number, header: BitstreamHeader) => string | undefined;
  inputs: I;
  outputs: O;
  params: P;
  /**
   * Función pura: mismas entradas y parámetros → mismo resultado.
   * Puede lanzar excepciones; el motor las captura y marca solo este nodo.
   */
  process(ctx: ProcessContext<I, P>): ProcessResult<O>;
}

/** Tipo "borrado" que usa el motor para tratar todos los bloques igual. */
export type AnyBlock = BlockDefinition<PortSpecs, PortSpecs, ParamSpecs>;

/** Ayuda a TypeScript a inferir los tipos de entradas, salidas y parámetros. */
export function defineBlock<
  const I extends PortSpecs,
  const O extends PortSpecs,
  const P extends ParamSpecs,
>(def: BlockDefinition<I, O, P>): BlockDefinition<I, O, P> & AnyBlock {
  // El tipo concreto sirve para los tests del bloque; el "borrado" (AnyBlock),
  // para que el motor pueda guardar todos los bloques en el mismo registro.
  return def as BlockDefinition<I, O, P> & AnyBlock;
}

// ─── Grafo ──────────────────────────────────────────────────────────────────

/** Lo que se sabe de lo que entra al bloque al construir su interior. */
export type InteriorInputs = Record<string, ValueSummary | undefined>;

export interface InteriorGraph {
  nodes: { id: string; type: string; x: number; y: number; params?: Record<string, ParamValue> }[];
  /** [origen, puertoOrigen, destino, puertoDestino] */
  edges: [string, string, string, string][];
  /** Puerto de entrada del bloque → id del nodo interior que lo recibe. */
  inputs: Record<string, string>;
  /** Puerto de salida del bloque → [nodo interior, puerto] que lo produce. */
  outputs: Record<string, [string, string]>;
}

export type ParamValue = number | string | boolean | null;

export interface GraphNode {
  id: string;
  type: string;
  params: Record<string, ParamValue>;
}

export interface GraphEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Resultado de ejecutar el grafo ─────────────────────────────────────────

export type NodeStatus = 'ok' | 'error' | 'waiting';

/** Resumen ligero de un valor, pensado para pintar sin copiar el valor entero. */
export type ValueSummary =
  | {
      kind: 'signal';
      sampleRate: number;
      length: number;
      durationS: number;
      peak: number;
      rms: number;
      /** Envolvente min/max decimada para miniaturas. */
      preview: { min: Float32Array; max: Float32Array };
      /** Trozo corto (~15 ms) de la zona con más energía: deja ver la forma de onda. */
      snippet: Float32Array;
    }
  | {
      kind: 'bitstream';
      codec: string;
      bitLength: number;
      bitrate: number;
      compression: number;
      /** Primeros bits, para enseñarlos en el inspector del cable. */
      firstBits: string;
      /** Bits por unidad cuando el flujo no es audio (bits/píxel, bits/carácter). */
      perUnit?: { name: string; bits: number };
    }
  | {
      kind: 'image';
      width: number;
      height: number;
      color: Image['color'];
      domain: Image['domain'];
      /** Tamaño de cada plano (se ve el submuestreo de crominancia). */
      planes: { width: number; height: number }[];
      /** Miniatura RGBA (lado mayor ≤ 128 px). */
      thumb: { width: number; height: number; rgba: Uint8ClampedArray };
    }
  | {
      kind: 'frames';
      domain: Frames['domain'];
      count: number;
      size: number;
      hop: number;
      sampleRate: number;
      /** Valor absoluto medio de cada índice (≤ 64 grupos), para una miniatura. */
      profile: Float32Array;
    }
  | {
      kind: 'packets';
      protocol: string;
      count: number;
      lost: number;
      packetMs: number;
      packetsPerSecond: number;
      /** Tasa en la red, cabeceras incluidas (bps). */
      networkBitrate: number;
      payloadBitrate: number;
    };

export interface PortResult {
  summary: ValueSummary;
  /** Retardo acumulado desde la entrada hasta este puerto (ms). */
  latencyMs: number;
}

export interface NodeResult {
  status: NodeStatus;
  error?: string;
  /** Puertos de entrada obligatorios sin conectar (cuando status = 'waiting'). */
  missingInputs?: string[];
  metrics: Metric[];
  plots: Plot[];
  /** Retardo propio del bloque (ms). */
  ownLatencyMs: number;
  outputs: Record<string, PortResult>;
  /** Tiempo de cómputo (ms). 0 si vino de caché. */
  computeMs: number;
  cached: boolean;
}

export interface RunResult {
  nodes: Record<string, NodeResult>;
  /** Problemas del grafo (cables con tipos incompatibles, ciclos…). */
  graphErrors: { edgeId?: string; nodeId?: string; message: string }[];
  totalMs: number;
}

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
  sampleRate: number;
  numSamples: number;
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
}

export type PortValue = Signal | Bitstream;
export type PortType = PortValue['kind'];

// ─── Parámetros configurables de un bloque ──────────────────────────────────

/** Muestra el parámetro solo cuando otro tiene ciertos valores (p. ej. μ solo con ley μ). */
interface ParamBase {
  visibleIf?: { param: string; equals: readonly (string | boolean)[] };
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

export type ParamSpec = NumberParam | SelectParam | BooleanParam | AudioParam;
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
    }
  | {
      kind: 'bars';
      title: string;
      values: number[];
      labels?: string[];
      /** Índices de barras resaltadas (p. ej. coeficientes conservados). */
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
  | 'utilidades'
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

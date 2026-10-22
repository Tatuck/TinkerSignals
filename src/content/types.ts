import type { ParamValue } from '@/engine/types';

/**
 * Tipos del contenido didáctico: temas, ejemplos, lecciones y problemas.
 *
 * Cada pieza de contenido es un fichero propio dentro de `src/content/<tipo>/`
 * y se descubre sola (ver `content/index.ts`): añadir una lección o un
 * problema no obliga a tocar ningún otro fichero. Todo es TS puro (sin
 * React) para poder comprobarlo con tests en Node.
 */

// ─── Resaltado ──────────────────────────────────────────────────────────────

/** Qué señalar en el lienzo. Los ids son los de los nodos del circuito. */
export interface Focus {
  nodes?: string[];
  /** Cables como 'origen>destino' (ids de nodo). */
  edges?: string[];
  params?: { node: string; key: string }[];
  metrics?: { node: string; key: string }[];
}

// ─── Clasificación ──────────────────────────────────────────────────────────

export type TopicId =
  | 'muestreo'
  | 'cuantizacion'
  | 'prediccion'
  | 'sin-perdidas'
  | 'voz'
  | 'perceptual'
  | 'imagen'
  | 'red'
  | 'calidad'
  | 'esteganografia';

export type Level = 'basico' | 'intermedio' | 'avanzado';

/** Para quién es sobre todo: estudiar a fondo, curiosear o probar combinaciones rápido. */
export type Audience = 'estudiar' | 'curiosear' | 'probar';

/** Metadatos comunes a todo el contenido: así se ordena y se filtra el catálogo. */
export interface Meta {
  topic: TopicId;
  level: Level;
  audience?: Audience[];
  /** Palabras extra para el buscador. */
  tags?: string[];
  /** Orden dentro del tema (menor = antes). */
  order?: number;
}

export interface Topic {
  id: TopicId;
  title: string;
  summary: string;
  /** Fichas de teoría por las que empezar. */
  concepts: string[];
}

// ─── Circuitos ──────────────────────────────────────────────────────────────

export interface Circuit {
  nodes: { id: string; type: string; x: number; y: number; params?: Record<string, ParamValue> }[];
  /** [origen, puertoOrigen, destino, puertoDestino] */
  edges: [string, string, string, string][];
}

/** Circuito ya montado que se abre desde el catálogo. */
export interface Example extends Meta, Circuit {
  id: string;
  title: string;
  description: string;
}

// ─── Lecciones ──────────────────────────────────────────────────────────────

/** Lo que una lección puede consultar del circuito para saber si se ha hecho el paso. */
export interface LessonContext {
  param(nodeId: string, key: string): ParamValue | undefined;
  metric(nodeId: string, key: string): number | undefined;
  hasEdge(source: string, target: string): boolean;
  /** ¿Hay en el circuito algún bloque de este tipo? Devuelve su id. */
  nodeOfType(type: string): string | undefined;
}

/** Pregunta de «¿qué crees que pasará?» antes de dejar actuar. */
export interface Prediction {
  question: string;
  options: string[];
  /** Índice de la opción correcta. */
  answer: number;
  /** Explicación que se muestra al responder. */
  explain: string;
}

export interface LessonStep {
  /**
   * Texto enriquecido: admite fórmulas `$…$`, **negrita** y enlaces que
   * resaltan cosas del lienzo, p. ej. `[[el predictor|n:pred]]` (ver
   * `content/richText.ts`).
   */
  text: string;
  /** Bloque que se resalta y se selecciona (atajo de `focus.nodes`). */
  node?: string;
  /** Parámetro del bloque `node` que se resalta en el panel. */
  param?: string;
  /** Resaltado de varias cosas a la vez. */
  focus?: Focus;
  /** Ficha de teoría que se incrusta en el paso (id de `theory/es.ts`). */
  theory?: string;
  predict?: Prediction;
  /** Qué hacer, si el paso espera una acción. */
  task?: string;
  check?: (c: LessonContext) => boolean;
}

export interface Lesson extends Meta {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  /** Ejemplo que se carga al empezar. Sin él, la lección usa el circuito que haya. */
  example?: string;
  steps: LessonStep[];
}

// ─── Problemas ──────────────────────────────────────────────────────────────

/** Una tabla de resultado de un bloque (gráfica `table`). */
export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** Tabla de la solución calculada por el propio problema. */
export interface SolutionTable extends TableData {
  title: string;
  notes?: string[];
  /** Se revela fila a fila. */
  stepwise?: boolean;
}

/** Lo que un problema puede leer del circuito que lo resuelve. */
export interface SolveContext {
  metric(nodeId: string, key: string): number | undefined;
  table(nodeId: string, title: string): TableData | undefined;
}

export interface ProblemAnswer<D> {
  key: string;
  /** Texto enriquecido. */
  label: string;
  unit?: string;
  /** 'number' (por defecto) admite coma decimal; 'text' compara sin espacios ni mayúsculas. */
  kind?: 'number' | 'text';
  /** Error absoluto admitido. Por defecto, el 0,5 % del valor (mínimo 0,01). */
  tolerance?: number;
  solve(data: D, r: SolveContext): number | string | undefined;
}

export interface Problem<D = unknown> extends Meta {
  id: string;
  title: string;
  /** Datos del enunciado a partir de un generador aleatorio con semilla. */
  generate(rand: () => number): D;
  /** Enunciado (texto enriquecido). */
  statement(data: D): string;
  /**
   * Circuito con los bloques reales que resuelve el problema. Su resultado
   * llega a `answers[].solve` y sus tablas son la solución paso a paso.
   */
  circuit?(data: D): Circuit;
  answers: ProblemAnswer<D>[];
  /** Pistas, de menos a más. */
  hints?: (data: D) => string[];
  /** Explicación de la solución (texto enriquecido). */
  explain?: (data: D, r: SolveContext) => string;
  /** Tablas del circuito que se enseñan como solución: [nodo, título de la gráfica]. */
  solutionTables?: [string, string][];
  /**
   * Tablas de la solución que calcula el propio problema, para ejercicios
   * con reglas propias del enunciado (un cuantizador concreto, un
   * redondeo…) que ningún bloque hace tal cual.
   */
  tables?: (data: D, r: SolveContext) => SolutionTable[];
}

/** Ayudas de TypeScript para inferir tipos al definir contenido. */
export const defineExample = (e: Example): Example => e;
export const defineLesson = (l: Lesson): Lesson => l;
export function defineProblem<D>(p: Problem<D>): Problem<unknown> {
  return p as unknown as Problem<unknown>;
}

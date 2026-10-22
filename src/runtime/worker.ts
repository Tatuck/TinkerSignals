/// <reference lib="webworker" />
/**
 * Punto de composición: aquí se juntan el motor y los bloques reales.
 * Todo el cálculo pesado ocurre en este Web Worker para que la interfaz
 * nunca se congele.
 *
 * Hay dos motores: el del circuito principal y el del «interior» de un
 * bloque (su circuito equivalente con piezas básicas).
 */
import * as Comlink from 'comlink';
import { createRegistry } from '@/blocks';
import { logSpectralDistance, segmentalSnr, snr } from '@/engine/dsp/metrics';
import { Engine } from '@/engine/evaluator';
import { makeImage, makePlane, toRgba } from '@/engine/dsp/image';
import type { Graph, ParamValue, Signal } from '@/engine/types';
import { BENCH_FAMILIES, type BenchPoint } from './benchConfigs';
import { probe, probeBits } from './probe';

/** 'scratch' es un motor de usar y tirar: resuelve los problemas sin tocar el lienzo. */
export type Scope = 'main' | 'interior' | 'scratch';

/** Motor aparte para el comparador tasa–calidad (no toca los circuitos). */
const bench = { engine: undefined as unknown as Engine, decoded: new Map<string, Signal>() };

const registry = createRegistry();
let benchRate = 16000;
const engines: Record<Scope, Engine> = {
  main: new Engine(registry),
  interior: new Engine(registry),
  scratch: new Engine(registry),
};
bench.engine = new Engine(registry);

const api = {
  run: (graph: Graph, scope: Scope = 'main') => engines[scope].run(graph),
  setAsset: (id: string, samples: Float32Array, sampleRate: number) =>
    engines.main.setAsset(id, { kind: 'signal', samples, sampleRate }),
  /** Registra una imagen cargada (RGBA del navegador) como imagen RGB del motor. */
  setImageAsset(id: string, width: number, height: number, rgba: Uint8ClampedArray) {
    const planes = [0, 1, 2].map(() => makePlane(width, height));
    for (let i = 0; i < width * height; i++)
      for (let c = 0; c < 3; c++) planes[c].data[i] = rgba[i * 4 + c];
    engines.main.setExternal(id, makeImage(planes, 'rgb'));
  },
  deleteAsset: (id: string) => engines.main.deleteAsset(id),
  /** Imagen completa de una salida, lista para guardarla como PNG. */
  getImage(nodeId: string, port: string, scope: Scope = 'main') {
    const v = engines[scope].getValue(nodeId, port);
    return v?.kind === 'image' ? toRgba(v, Infinity) : null;
  },
  probeOutput(nodeId: string, port: string, scope: Scope = 'main') {
    const v = engines[scope].getValue(nodeId, port);
    return v ? probe(v) : null;
  },
  /** Visor de bits: qué significa cada campo de unas tramas del flujo de una salida. */
  probeBits(nodeId: string, port: string, frame: number, scope: Scope = 'main') {
    const v = engines[scope].getValue(nodeId, port);
    if (v?.kind !== 'bitstream') return null;
    const describe = v.layout?.block ? registry.get(v.layout.block)?.describeField : undefined;
    return probeBits(v, frame, describe);
  },
  /** Señal completa de una salida o de una entrada (para escuchar o descargar). */
  getSignal(
    nodeId: string,
    port: string,
    side: 'out' | 'in',
    scope: Scope = 'main',
  ): Signal | null {
    const e = engines[scope];
    const v = side === 'out' ? e.getValue(nodeId, port) : e.getInputValue(nodeId, port);
    return v?.kind === 'signal' ? v : null;
  },
  /**
   * Comparador: fija la señal de entrada (la salida `port` del nodo
   * `nodeId` del circuito principal) y la frecuencia a la que se compara.
   * Devuelve false si ese cable no lleva señal.
   */
  benchSource(nodeId: string, port: string, sampleRate: number): boolean {
    const v = engines.main.getValue(nodeId, port);
    if (v?.kind !== 'signal') return false;
    bench.engine.setExternal('inner:in', v);
    bench.decoded.clear();
    benchRate = sampleRate;
    return true;
  },
  /** Comparador: codifica y decodifica con una configuración y mide la calidad. */
  benchPoint(familyId: string, value: ParamValue): BenchPoint {
    const fam = BENCH_FAMILIES.find((f) => f.id === familyId)!;
    const point: BenchPoint = {
      family: familyId,
      value,
      bitrate: NaN,
      snr: NaN,
      snrSeg: NaN,
      lsd: NaN,
      computeMs: 0,
    };
    const t0 = performance.now();
    const res = bench.engine.run({
      nodes: [
        { id: 'src', type: 'inner-signal-in', params: { port: 'in' } },
        { id: 'rs', type: 'resampler', params: { sampleRate: String(benchRate) } },
        { id: 'enc', type: fam.encoder, params: { ...fam.base, [fam.sweep.param]: value } },
        { id: 'dec', type: fam.decoder, params: {} },
      ],
      edges: [
        { id: 'a', source: 'src', sourcePort: 'out', target: 'rs', targetPort: 'in' },
        { id: 'b', source: 'rs', sourcePort: 'out', target: 'enc', targetPort: 'in' },
        { id: 'c', source: 'enc', sourcePort: 'out', target: 'dec', targetPort: 'in' },
      ],
    });
    point.computeMs = performance.now() - t0;
    const failed = Object.values(res.nodes).find((n) => n.status !== 'ok');
    const ref = bench.engine.getValue('rs', 'out');
    const bits = bench.engine.getValue('enc', 'out');
    const out = bench.engine.getValue('dec', 'out');
    if (failed || ref?.kind !== 'signal' || bits?.kind !== 'bitstream' || out?.kind !== 'signal') {
      point.error = failed?.error ?? 'No se ha podido calcular';
      return point;
    }
    point.bitrate = (bits.bitLength * ref.sampleRate) / ref.samples.length;
    point.snr = snr(ref.samples, out.samples);
    point.snrSeg = segmentalSnr(ref.samples, out.samples);
    point.lsd = logSpectralDistance(ref.samples, out.samples);
    bench.decoded.set(`${familyId}:${String(value)}`, out);
    bench.decoded.set('ref', ref);
    return point;
  },
  /** Comparador: audio decodificado de un punto (o 'ref' para la entrada). */
  benchSignal: (key: string): Signal | null => bench.decoded.get(key) ?? null,
  /** Lupa temporal: gráficas de un nodo en un instante. */
  inspectAt: (nodeId: string, timeS: number, scope: Scope = 'main') =>
    engines[scope].inspectAt(nodeId, timeS),
  /**
   * Prepara el interior de un bloque: le pasa los mismos valores que entran
   * al bloque en el circuito principal (como valores inyectados `inner:<puerto>`).
   * Devuelve qué puertos estaban conectados.
   */
  prepareInterior(nodeId: string, inputPorts: string[]): string[] {
    const ready: string[] = [];
    for (const port of inputPorts) {
      const v = engines.main.getInputValue(nodeId, port);
      if (v) {
        engines.interior.setExternal(`inner:${port}`, v);
        ready.push(port);
      }
    }
    return ready;
  },
  /** Compara la salida del interior con la del bloque real. */
  compareInterior(
    nodeId: string,
    port: string,
    innerNode: string,
    innerPort: string,
  ):
    | { kind: 'signal'; snr: number }
    | { kind: 'bits'; equalBits: number; totalBits: number }
    | null {
    const real = engines.main.getValue(nodeId, port);
    const inner = engines.interior.getValue(innerNode, innerPort);
    if (!real || !inner) return null;
    if (real.kind === 'signal' && inner.kind === 'signal')
      return { kind: 'signal', snr: snr(real.samples, inner.samples) };
    if (real.kind === 'bitstream' && inner.kind === 'bitstream') {
      const n = Math.min(real.bitLength, inner.bitLength);
      let eq = 0;
      for (let i = 0; i < n; i++) {
        const a = (real.bytes[i >> 3] >> (7 - (i & 7))) & 1;
        const b = (inner.bytes[i >> 3] >> (7 - (i & 7))) & 1;
        if (a === b) eq++;
      }
      return { kind: 'bits', equalBits: eq, totalBits: Math.max(real.bitLength, inner.bitLength) };
    }
    return null;
  },
};

export type EngineApi = typeof api;
Comlink.expose(api);

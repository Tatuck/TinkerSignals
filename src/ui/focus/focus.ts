import { create } from 'zustand';
import type { Focus } from '@/content/types';

export type { Focus };

/**
 * Resaltado del lienzo: qué bloques, cables, parámetros o métricas hay que
 * señalar ahora. Varias partes de la interfaz pueden pedir foco a la vez
 * (la lección en curso, un enlace bajo el ratón, la ficha de teoría…); cada
 * una escribe en su capa y lo que se ve es la unión de todas.
 */
export type FocusLayer = 'lesson' | 'hover' | 'theory' | 'problem';
type Layers = Partial<Record<FocusLayer, Focus>>;

interface FocusState {
  layers: Layers;
  set(layer: FocusLayer, focus: Focus | null): void;
}

export const useFocus = create<FocusState>((set, get) => ({
  layers: {},
  set(layer, focus) {
    const layers = { ...get().layers };
    if (focus && !isEmpty(focus)) layers[layer] = focus;
    else if (!layers[layer]) return;
    else delete layers[layer];
    set({ layers });
  },
}));

export function setFocus(layer: FocusLayer, focus: Focus | null): void {
  useFocus.getState().set(layer, focus);
}

function isEmpty(f: Focus): boolean {
  return !f.nodes?.length && !f.edges?.length && !f.params?.length && !f.metrics?.length;
}

const all = (l: Layers) => Object.values(l) as Focus[];

// Consultas puras sobre las capas (sirven dentro de bucles, donde no caben hooks).

export const hasCanvasFocus = (l: Layers) =>
  all(l).some((f) => !!f.nodes?.length || !!f.edges?.length);

export const isNodeFocused = (l: Layers, id: string) =>
  all(l).some(
    (f) =>
      f.nodes?.includes(id) ||
      f.params?.some((p) => p.node === id) ||
      f.metrics?.some((m) => m.node === id),
  );

/** Un cable se resalta si se nombra «origen>destino» o si lo están sus dos extremos. */
export const isEdgeFocused = (l: Layers, source: string, target: string) =>
  all(l).some(
    (f) =>
      f.edges?.includes(`${source}>${target}`) ||
      (!!f.nodes?.includes(source) && !!f.nodes?.includes(target)),
  );

export const isParamFocused = (l: Layers, node: string, key: string) =>
  all(l).some((f) => f.params?.some((p) => p.node === node && p.key === key));

export const isMetricFocused = (l: Layers, node: string, key: string) =>
  all(l).some((f) => f.metrics?.some((m) => m.node === node && m.key === key));

// Hooks para un solo elemento (solo se vuelven a pintar si cambia su respuesta).

export const useHasCanvasFocus = () => useFocus((s) => hasCanvasFocus(s.layers));
export const useNodeFocused = (id: string) => useFocus((s) => isNodeFocused(s.layers, id));
export const useEdgeFocused = (source: string, target: string) =>
  useFocus((s) => isEdgeFocused(s.layers, source, target));
export const useFocusLayers = () => useFocus((s) => s.layers);

/** Une varios focos en uno. */
export function mergeFocus(...fs: (Focus | undefined)[]): Focus {
  const out: Focus = {};
  for (const f of fs) {
    if (!f) continue;
    if (f.nodes) out.nodes = [...(out.nodes ?? []), ...f.nodes];
    if (f.edges) out.edges = [...(out.edges ?? []), ...f.edges];
    if (f.params) out.params = [...(out.params ?? []), ...f.params];
    if (f.metrics) out.metrics = [...(out.metrics ?? []), ...f.metrics];
  }
  return out;
}

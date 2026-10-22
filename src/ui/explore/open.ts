import { create } from 'zustand';
import type { CatalogItem, ItemKind } from '@/content';
import type { Audience, Level, TopicId } from '@/content/types';
import { exampleById, instantiate } from '../examples';
import { itemKey } from '../catalog';
import { useLesson } from '../lessons/lessonStore';
import { useProgress } from '../lib/progress';
import { useProblem } from '../problems/problemStore';
import { useStore } from '../store';

export type ExploreKind = ItemKind | 'todo';

interface Filters {
  kind: ExploreKind;
  topic: TopicId | 'todos';
  level: Level | 'todos';
  audience: Audience | 'todos';
  query: string;
}

interface ExploreState extends Filters {
  /** Desplazamiento de la lista, para volver justo donde se estaba. */
  scroll: number;
  /** Ejemplo abierto desde Explorar (con los ids de sus nodos, para saber si sigue en el lienzo). */
  example: { id: string; title: string; nodes: string[] } | null;
  setFilters(f: Partial<Filters>): void;
}

const FRESH: Filters = {
  kind: 'todo',
  topic: 'todos',
  level: 'todos',
  audience: 'todos',
  query: '',
};

/**
 * Estado del catálogo que sobrevive a cerrarlo: al volver a Explorar desde
 * una lección, un problema o un ejemplo se ve lo mismo que se dejó.
 */
export const useExplore = create<ExploreState>((set) => ({
  ...FRESH,
  scroll: 0,
  example: null,
  setFilters: (f) => set({ ...f, scroll: 0 }),
}));

export const explore = {
  /** Abre el catálogo desde cero, mostrando solo un tipo de contenido. */
  open(kind: ExploreKind = 'todo') {
    useExplore.setState({ ...FRESH, kind, scroll: 0, example: null });
    useStore.setState({ explore: true, theory: null });
  },
  /** Vuelve al catálogo tal y como se dejó (filtros y posición). */
  back() {
    // El problema no se cierra: se esconde, y su aviso en el lienzo permite volver a él.
    if (useProblem.getState().visible) useProblem.setState({ visible: false });
    useExplore.setState({ example: null });
    useStore.setState({ explore: true, theory: null });
  },
  close: () => useStore.setState({ explore: false, theory: null }),
};

/**
 * Abre una entrada del catálogo, sea del tipo que sea. Las fichas de teoría
 * se leen dentro del propio Explorar; lo demás cierra el catálogo.
 */
export function openItem(item: Pick<CatalogItem, 'kind' | 'id' | 'title'>): void {
  useProgress.getState().markSeen(itemKey(item));
  if (item.kind === 'teoria') {
    useStore.setState({ explore: true, theory: item.id });
    return;
  }
  explore.close();
  useExplore.setState({ example: null });
  switch (item.kind) {
    case 'leccion':
      useProblem.getState().close();
      useLesson.getState().start(item.id);
      break;
    case 'ejemplo': {
      const ex = exampleById(item.id);
      if (!ex) return;
      const g = instantiate(ex);
      useStore.getState().load(g.nodes, g.edges);
      useLesson.getState().exit();
      useProblem.getState().close();
      useExplore.setState({
        example: { id: item.id, title: item.title, nodes: g.nodes.map((n) => n.id) },
      });
      break;
    }
    case 'problema':
      useLesson.getState().exit();
      useProblem.getState().open(item.id);
      break;
  }
}

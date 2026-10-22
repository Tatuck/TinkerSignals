import type { Lesson, LessonStep } from '@/content/types';
import { validateGraph } from '@/engine/graph';
import { blockText } from '@/i18n';
import { conceptFor } from '@/theory/es';
import { registry } from '../registry';
import { toGraph, type BlockNode, type CableEdge } from '../store';

/**
 * Recorrido guiado de cualquier circuito, generado a partir de él: sigue
 * la señal en orden topológico (de las fuentes a las salidas) y explica
 * cada bloque con sus propios textos (resumen, detalles y fichas). No hay
 * nada escrito a mano por ejemplo: sirve igual para un circuito propio.
 */
export function buildTour(nodes: BlockNode[], edges: CableEdge[]): Lesson | null {
  if (!nodes.length) return null;
  const { order } = validateGraph(toGraph(nodes, edges), registry);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const title = (id: string) => blockText(byId.get(id)?.data.blockType ?? '').title;

  const steps: LessonStep[] = [
    {
      text: `Vamos a recorrer este circuito bloque a bloque, en el orden en que viaja la información: de las fuentes a las salidas. Son ${order.length} bloques.\n\nPasa el ratón por los nombres subrayados para verlos en el lienzo; púlsalos para ir hasta ellos.`,
    },
  ];

  for (const id of order) {
    const node = byId.get(id);
    if (!node) continue;
    const text = blockText(node.data.blockType);
    const incoming = edges.filter((e) => e.target === id);
    const outgoing = edges.filter((e) => e.source === id);
    const portName = (blockId: string, port: string | null | undefined) =>
      blockText(byId.get(blockId)?.data.blockType ?? '').ports?.[port ?? ''] ?? port ?? '';

    const parts = [`**${text.title}.** ${text.summary}`];
    if (incoming.length)
      parts.push(
        'Recibe ' +
          incoming
            .map(
              (e) =>
                `«${portName(id, e.targetHandle)}» desde [[${title(e.source)}|e:${e.source}>${id}]]`,
            )
            .join(', ') +
          (outgoing.length
            ? ` y lo envía a ${[...new Set(outgoing.map((e) => e.target))]
                .map((t) => `[[${title(t)}|n:${t}]]`)
                .join(', ')}.`
            : '.'),
      );
    else if (outgoing.length)
      parts.push(
        `Es una fuente: de aquí sale lo que reciben ${[...new Set(outgoing.map((e) => e.target))]
          .map((t) => `[[${title(t)}|n:${t}]]`)
          .join(', ')}.`,
      );
    if (text.details) parts.push(text.details);
    const concepts = [
      ...new Map(
        (text.concepts ?? [])
          .map((c) => conceptFor(c))
          .filter((c) => !!c)
          .map((c) => [c!.id, c!]),
      ).values(),
    ];
    if (concepts.length)
      parts.push('Teoría: ' + concepts.map((c) => `[[${c.title}|c:${c.id}]]`).join(' · '));

    steps.push({
      text: parts.join('\n\n'),
      node: id,
      focus: { edges: incoming.map((e) => `${e.source}>${id}`) },
    });
  }

  steps.push({
    text: 'Fin del recorrido. Ahora cambia algún parámetro y sigue el efecto por los bloques de después: el motor solo recalcula lo que depende de lo que has tocado.',
  });

  return {
    id: '_recorrido',
    title: 'Recorrido del circuito',
    summary: 'Cada bloque del circuito, en orden.',
    minutes: Math.max(1, Math.round(order.length / 2)),
    topic: 'muestreo',
    level: 'basico',
    steps,
  };
}

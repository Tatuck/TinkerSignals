import type { ParamValue } from '@/engine/types';
import type { BlockNode, CableEdge } from '../store';

/**
 * Circuitos en la URL: el grafo se serializa en JSON compacto, se comprime
 * con deflate y va en el fragmento (#c=…), que nunca llega al servidor.
 * Los audios cargados o grabados no viajan: solo la estructura y los ajustes.
 */
interface Compact {
  v: 1;
  n: [id: string, type: string, x: number, y: number, params: Record<string, ParamValue>][];
  e: [source: string, sourcePort: string, target: string, targetPort: string][];
}

export async function encodeCircuit(nodes: BlockNode[], edges: CableEdge[]): Promise<string> {
  const data: Compact = {
    v: 1,
    n: nodes.map((n) => [
      n.id,
      n.data.blockType,
      Math.round(n.position.x),
      Math.round(n.position.y),
      // Los ids de audio locales no sirven en otro ordenador.
      Object.fromEntries(Object.entries(n.data.params).filter(([k]) => k !== 'audio')),
    ]),
    e: edges.map((e) => [e.source, e.sourceHandle ?? '', e.target, e.targetHandle ?? '']),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const compressed = await streamBytes(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')),
  );
  return toBase64Url(compressed);
}

export async function decodeCircuit(
  code: string,
): Promise<{ nodes: BlockNode[]; edges: CableEdge[] }> {
  const bytes = fromBase64Url(code);
  const raw = await streamBytes(
    new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw')),
  );
  const data = JSON.parse(new TextDecoder().decode(raw)) as Compact;
  if (data.v !== 1) throw new Error('Versión de enlace desconocida');
  return {
    nodes: data.n.map(([id, type, x, y, params]) => ({
      id,
      type: 'block',
      position: { x, y },
      data: { blockType: type, params },
    })),
    edges: data.e.map(([source, sourceHandle, target, targetHandle], i) => ({
      id: `s${i}`,
      type: 'cable',
      source,
      sourceHandle,
      target,
      targetHandle,
    })),
  };
}

async function streamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array {
  const s = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

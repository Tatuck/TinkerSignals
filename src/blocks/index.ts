import { BlockRegistry } from '@/engine/registry';
import type { AnyBlock } from '@/engine/types';

/**
 * Autodescubrimiento de bloques: cualquier carpeta `src/blocks/<id>/index.ts`
 * con un `export default defineBlock(...)` aparece en la paleta. No hay que
 * tocar ningún otro fichero para añadir un bloque.
 * Las carpetas que empiezan por "_" (plantilla, utilidades compartidas) se ignoran.
 */
const modules = import.meta.glob<{ default: AnyBlock }>(['./*/index.ts', '!./_*/**'], {
  eager: true,
});

export function createRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  for (const [path, mod] of Object.entries(modules)) {
    const folder = path.split('/')[1];
    if (mod.default.id !== folder) {
      throw new Error(`El bloque de "${path}" tiene id "${mod.default.id}"; debe ser "${folder}"`);
    }
    registry.register(mod.default);
  }
  return registry;
}

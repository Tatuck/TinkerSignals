import type { AnyBlock, ParamSpecs, ParamValue } from './types';

/**
 * Catálogo de bloques disponibles. El motor solo conoce los bloques a través
 * de esta clase, así que en los tests se puede crear un registro con bloques
 * de prueba sin cargar los reales.
 */
export class BlockRegistry {
  private readonly blocks = new Map<string, AnyBlock>();

  constructor(blocks: AnyBlock[] = []) {
    blocks.forEach((b) => this.register(b));
  }

  register(block: AnyBlock): void {
    if (this.blocks.has(block.id)) {
      throw new Error(`Bloque duplicado: "${block.id}"`);
    }
    validateDefinition(block);
    this.blocks.set(block.id, block);
  }

  get(id: string): AnyBlock | undefined {
    return this.blocks.get(id);
  }

  list(): AnyBlock[] {
    return [...this.blocks.values()];
  }
}

/** Valores por defecto de todos los parámetros de un bloque. */
export function defaultParams(specs: ParamSpecs): Record<string, ParamValue> {
  return Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, s.default]));
}

/**
 * Completa y sanea los parámetros guardados en un nodo: añade los que
 * falten, recorta números fuera de rango y descarta opciones inválidas.
 * Así un grafo guardado con una versión anterior de un bloque sigue funcionando.
 */
export function resolveParams(
  specs: ParamSpecs,
  stored: Record<string, ParamValue>,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [key, spec] of Object.entries(specs)) {
    const v = stored[key];
    switch (spec.type) {
      case 'number':
        out[key] =
          typeof v === 'number' && Number.isFinite(v)
            ? Math.min(spec.max, Math.max(spec.min, v))
            : spec.default;
        break;
      case 'select':
        out[key] = typeof v === 'string' && spec.options.includes(v) ? v : spec.default;
        break;
      case 'boolean':
        out[key] = typeof v === 'boolean' ? v : spec.default;
        break;
      case 'audio':
        out[key] = typeof v === 'string' ? v : null;
        break;
      case 'external':
        out[key] = typeof v === 'string' ? v : spec.default;
        break;
    }
  }
  return out;
}

function validateDefinition(b: AnyBlock): void {
  for (const [key, spec] of Object.entries(b.params)) {
    if (spec.type === 'number' && (spec.default < spec.min || spec.default > spec.max)) {
      throw new Error(`Bloque "${b.id}": el valor por defecto de "${key}" está fuera de rango`);
    }
    if (spec.type === 'select' && !spec.options.includes(spec.default)) {
      throw new Error(`Bloque "${b.id}": el valor por defecto de "${key}" no es una opción válida`);
    }
  }
}

import { createRegistry } from '@/blocks';

/**
 * Copia del registro en el hilo principal: la UI la usa solo para leer
 * metadatos (puertos, parámetros, categoría). Los `process` se ejecutan
 * en el Worker.
 */
export const registry = createRegistry();

/**
 * Lánzalo desde un bloque cuando le falta algo que no es un error del
 * usuario (p. ej. todavía no se ha cargado audio). El nodo se pinta como
 * "esperando" en lugar de en rojo.
 */
export class BlockWaiting extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockWaiting';
  }
}

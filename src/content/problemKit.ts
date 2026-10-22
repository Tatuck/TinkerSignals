/**
 * Ayudas para escribir problemas: sacar números al azar (con la semilla del
 * problema) y escribirlos como en un enunciado.
 */
import { num } from '@/blocks/_shared/traces';

export { binary, num } from '@/blocks/_shared/traces';

/** Entero al azar en [a, b]. */
export const int = (rand: () => number, a: number, b: number) =>
  a + Math.floor(rand() * (b - a + 1));

/** Un elemento al azar. */
export const pick = <T>(rand: () => number, xs: readonly T[]): T =>
  xs[Math.floor(rand() * xs.length)];

/** Baraja (Fisher-Yates) con el generador del problema. */
export function shuffle<T>(rand: () => number, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Redondea a `d` decimales y quita el ruido de coma flotante (0,30000000004 → 0,3). */
export const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

/** Lista de números para escribir en el bloque «Lista de números» (punto decimal, comas). */
export const asList = (xs: number[]) => xs.map((v) => String(round(v))).join(', ');

/** Número para escribir dentro de una fórmula `$…$` (coma decimal sin espacio). */
export const tex = (v: number, digits = 3) => num(v, digits).replace(',', '{,}').replace('−', '-');

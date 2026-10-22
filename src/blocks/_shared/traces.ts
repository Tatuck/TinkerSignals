/**
 * Ayudas para las tablas paso a paso (gráfica `table`): cómo escribir un
 * símbolo o un número para que la tabla se parezca a la que se haría a mano.
 */

/** Un símbolo: su número y, si es un carácter imprimible, el carácter. */
export function symbolLabel(sym: number, bits: number): string {
  return bits >= 7 && sym >= 32 && sym < 127 ? `${sym} «${String.fromCharCode(sym)}»` : String(sym);
}

/** Una secuencia de símbolos: como texto si todos son caracteres; si no, separados por comas. */
export function sequenceLabel(seq: number[], bits: number): string {
  if (bits >= 7 && seq.every((s) => s >= 32 && s < 127)) return `«${String.fromCharCode(...seq)}»`;
  return seq.join(',');
}

/** Número con coma decimal y signo menos tipográfico, para notas en texto. */
export function num(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  const s = Number.isInteger(v) ? String(v) : Number(v.toFixed(digits)).toString();
  return s.replace('.', ',').replace('-', '−');
}

/** Código binario de `len` bits. */
export const binary = (code: number, len: number) =>
  len > 0 ? code.toString(2).padStart(len, '0') : '';

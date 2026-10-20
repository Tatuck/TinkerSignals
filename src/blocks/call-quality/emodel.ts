/**
 * Modelo E (ITU-T G.107), en su forma simplificada habitual para VoIP:
 *   R = 93,2 − Id − Ie,eff
 * con los valores por defecto del estándar para el resto de factores.
 */

/** Deterioro por retardo en un sentido (aproximación de Cole y Rosenbluth). */
export function delayImpairment(ta: number): number {
  return 0.024 * ta + (ta > 177.3 ? 0.11 * (ta - 177.3) : 0);
}

/** Deterioro del códec con pérdidas de paquetes (Ppl en %). */
export function effectiveEquipmentImpairment(
  ie: number,
  bpl: number,
  ppl: number,
  burstR: number,
): number {
  return ie + ((95 - ie) * ppl) / (ppl / burstR + bpl);
}

export function rFactor(ta: number, ie: number, bpl: number, ppl: number, burstR = 1): number {
  return 93.2 - delayImpairment(ta) - effectiveEquipmentImpairment(ie, bpl, ppl, burstR);
}

/** De R a MOS (escala de 1 a 4,5). */
export function mosFromR(r: number): number {
  if (r <= 0) return 1;
  if (r >= 100) return 4.5;
  return 1 + 0.035 * r + r * (r - 60) * (100 - r) * 7e-6;
}

/** Categoría de satisfacción de G.109 según R. */
export function satisfaction(
  r: number,
): 'very' | 'satisfied' | 'some' | 'many' | 'nearly-all' | 'not' {
  if (r >= 90) return 'very';
  if (r >= 80) return 'satisfied';
  if (r >= 70) return 'some';
  if (r >= 60) return 'many';
  if (r >= 50) return 'nearly-all';
  return 'not';
}

/**
 * Factores de deterioro de los códecs (ITU-T G.113, apéndice I). Los de los
 * códecs didácticos de esta web son aproximaciones: no están normalizados.
 */
export const CODECS = {
  'g711-plc': { ie: 0, bpl: 25.1, approx: false },
  g711: { ie: 0, bpl: 4.3, approx: false },
  g726: { ie: 7, bpl: 10, approx: true },
  g729: { ie: 11, bpl: 19, approx: false },
  g723: { ie: 15, bpl: 16.1, approx: false },
  lpc: { ie: 45, bpl: 10, approx: true },
} as const;
export type CodecId = keyof typeof CODECS;

/** Qué códec de la tabla se parece más al flujo que llega. */
export function guessCodec(header: Record<string, unknown>): CodecId {
  switch (header.codec) {
    case 'pcm':
      return 'g711-plc';
    case 'adpcm-ima':
    case 'dpcm':
      return 'g726';
    case 'celp':
      return 'g729';
    case 'lpc':
      return 'lpc';
    default:
      return 'g711-plc';
  }
}

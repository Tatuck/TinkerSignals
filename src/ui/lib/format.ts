/** Formatea números para humanos: 32 000 bps → "32 kbps", 0,0032 s → "3,2 ms". */
const nf = (digits: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
  return nf(digits).format(v);
}

export function formatMetric(value: number, unit?: string): { value: string; unit: string } {
  if (unit === 'bps') {
    if (value >= 1e6) return { value: formatNumber(value / 1e6, 2), unit: 'Mbps' };
    if (value >= 1e3) return { value: formatNumber(value / 1e3, 1), unit: 'kbps' };
    return { value: formatNumber(value, 0), unit: 'bps' };
  }
  if (unit === 'Hz' && value >= 1000) return { value: formatNumber(value / 1000, 2), unit: 'kHz' };
  if (unit === 'ms') return { value: formatNumber(value, 1), unit: 'ms' };
  if (unit === 'dB') return { value: formatNumber(value, 1), unit: 'dB' };
  if (unit === '×') return { value: formatNumber(value, 1), unit: '×' };
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return { value: formatNumber(value, digits), unit: unit ?? '' };
}

export function formatRate(hz: number): string {
  const m = formatMetric(hz, 'Hz');
  return `${m.value} ${m.unit}`;
}

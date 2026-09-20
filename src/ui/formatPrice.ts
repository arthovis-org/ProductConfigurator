const formatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(amount: number, currency: string): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

/** `+€120` / `−€60`, or an empty string for zero. */
export function formatPriceDelta(delta: number, currency: string): string {
  if (delta === 0) return '';
  return `${delta > 0 ? '+' : '−'}${formatPrice(Math.abs(delta), currency)}`;
}

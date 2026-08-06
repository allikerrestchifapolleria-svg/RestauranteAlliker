/**
 * Utilidades de fecha con la misma semantica que el dashboard: los limites del
 * dia se derivan SIEMPRE de las componentes de fecha locales (getFullYear,
 * getMonth, getDate), nunca de strings 'YYYY-MM-DD' (que JS interpreta como
 * medianoche UTC y en zonas al oeste de UTC cae en el dia anterior).
 */

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Convierte un 'YYYY-MM-DD' a un Date local (mediodia local, sin shift UTC). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Formatea un Date a 'YYYY-MM-DD' usando las componentes locales. */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

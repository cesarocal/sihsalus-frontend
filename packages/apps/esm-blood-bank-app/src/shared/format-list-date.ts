import { isDate } from '../sections/applicant-selection/selection-rules';

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatListDate(value?: string) {
  if (!value) return '—';
  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = dayFirst ? `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}.*)?$/.test(iso) || !isDate(iso.slice(0, 10))) return '—';
  const hasTime = iso.includes('T');
  const date = new Date(hasTime ? iso : `${iso}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '—';

  const locale = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en-GB' : 'es-PE';
  const key = `${locale}:${hasTime}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(hasTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
    });
    formatters.set(key, formatter);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  const day = `${part('day')} ${part('month').replace(/\.$/, '')} ${part('year')}`;
  return hasTime ? `${day}, ${part('hour')}:${part('minute')}` : day;
}

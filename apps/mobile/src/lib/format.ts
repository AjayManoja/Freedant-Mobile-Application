import { formatInr } from '@feedants/shared';
import type { TFunction } from 'i18next';
import { ApiError } from '@/api/client';
import { MediaError } from '@/media/media';

export { formatInr };

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** A-15: stored in UTC, shown in the device's time zone. */
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
/** The design's compact date: "5 Oct 26". */
export const formatShortDate = (iso: string | null | undefined) =>
  iso ? shortFmt.format(new Date(iso)) : '—';
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFmt.format(new Date(iso)) : '—';

export function formatDuration(ms: number, t: TFunction): string {
  if (ms <= 0) return t('countdown.ended');
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return t('countdown.dh', { d, h: pad(h) });
  if (h > 0) return t('countdown.hm', { h: pad(h), m: pad(m) });
  return t('countdown.ms', { m: pad(m), s: pad(s % 60) });
}

export const formatBytes = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

/** One place that turns any failure into a friendly, translated message (NFR-UX-02). */
export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof MediaError) {
    if (err.reason === 'too-large') return t('errors.fileTooLarge', { size: formatBytes(err.maxBytes ?? 0) });
    return t('errors.unsupportedFile');
  }
  if (err instanceof ApiError) {
    const key = `errors.${err.code}`;
    const translated = t(key);
    return translated === key ? err.message : translated;
  }
  return t('common.somethingWrong');
}

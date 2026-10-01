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
  iso ? shortFmt.format(new Date(iso)).replace('Sept', 'Sep') : '—';
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
/** The design's relative stamp: "Today, 9:14 AM", "Yesterday, 8:02 PM", else "24 Sep 26". */
export function formatWhen(iso: string, t: TFunction, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  const time = timeFmt.format(d).toUpperCase();
  if (diff === 0) return t('common.todayAt', { time });
  if (diff === 1) return t('common.yesterdayAt', { time });
  return formatShortDate(iso);
}
/** NotificationsPage stamps: "12m ago", "3h ago", "Yesterday", "2 days ago", then a date. */
export function formatAgo(iso: string, t: TFunction, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return t('ago.now');
  if (min < 60) return t('ago.minutes', { count: min });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days === 0) return t('ago.hours', { count: Math.floor(min / 60) });
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('ago.days', { count: days });
  return formatShortDate(iso);
}
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

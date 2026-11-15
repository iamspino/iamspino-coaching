import type { Program, WorkoutExercise } from './types';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function fmtDate(iso: string | null | undefined, withYear = false) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'mai';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'ieri';
  if (d < 30) return `${d} giorni fa`;
  return fmtDate(iso, true);
}

export function fmtDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return '';
  const m = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function fmtRest(sec: number) {
  if (!sec) return '—';
  return sec < 60 ? `${sec}″` : `${Math.floor(sec / 60)}′${sec % 60 ? String(sec % 60).padStart(2, '0') + '″' : ''}`;
}

/** Prescrizione effettiva di un esercizio per una certa settimana (base + variazioni). */
export function prescription(we: WorkoutExercise, week: number) {
  const o = (we.week_overrides || {})[String(week)] || {};
  return {
    sets: o.sets ?? we.sets,
    reps: o.reps || we.reps,
    load: o.load ?? we.load,
    changed: Object.keys(o).length > 0,
  };
}

/** Settimana corrente di un programma in base alla data di invio/inizio. */
export function currentWeek(p: Pick<Program, 'start_date' | 'sent_at' | 'weeks'>) {
  const start = p.start_date || p.sent_at;
  if (!start) return 1;
  const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  return Math.min(Math.max(1, Math.floor(days / 7) + 1), p.weeks);
}

/** Massimale stimato (formula di Epley). */
export function estimated1RM(load: number, reps: number) {
  if (!load || !reps) return 0;
  return reps === 1 ? load : Math.round(load * (1 + reps / 30) * 10) / 10;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
}

export function num(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

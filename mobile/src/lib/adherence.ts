import type { Program, WorkoutLog } from './types';

type LogLite = Pick<WorkoutLog, 'completed_at' | 'program_id'>;

/** Lunedì (ore 00:00) della settimana che contiene `d`. */
function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

const WEEK = 7 * 86400000;

/**
 * Obiettivo settimanale del cliente: un allenamento per ogni giorno previsto dalle schede attive.
 * `streak` = settimane consecutive in cui l'obiettivo è stato raggiunto.
 */
export function weeklyGoal(programs: Pick<Program, 'workouts'>[], logs: LogLite[], now = new Date()) {
  const goal = programs.reduce((n, p) => n + (p.workouts?.length ?? 0), 0);
  const thisWeek = weekStart(now);
  const perWeek = new Map<number, number>();
  for (const l of logs) {
    if (!l.completed_at) continue;
    const w = weekStart(new Date(l.completed_at));
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const done = perWeek.get(thisWeek) ?? 0;
  let streak = goal > 0 && done >= goal ? 1 : 0;
  for (let w = thisWeek - WEEK; goal > 0 && (perWeek.get(w) ?? 0) >= goal; w -= WEEK) streak++;
  return { goal, done, streak };
}

/** Aderenza reale a una scheda: allenamenti completati / previsti fino ad oggi (0-100). */
export function programAdherence(p: Pick<Program, 'start_date' | 'sent_at' | 'weeks'>, workoutsPerWeek: number, completed: number, now = Date.now()) {
  const start = p.start_date || p.sent_at;
  if (!start || workoutsPerWeek === 0) return null;
  const elapsed = Math.min(p.weeks, Math.max(1, Math.ceil((now - new Date(start).getTime()) / WEEK)));
  return Math.min(100, Math.round((completed / (workoutsPerWeek * elapsed)) * 100));
}

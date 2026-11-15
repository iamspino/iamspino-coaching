// Test della funzione "draft-program" contro lo stack locale.
// Richiede: supabase start, supabase functions serve, e un endpoint AI (vero o finto) raggiungibile.
//   ANON=<anon key> [FN_URL=http://127.0.0.1:9100] node supabase/tests/ai-draft.test.mjs
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321', ANON = process.env.ANON;
const mk = () => createClient(URL, ANON, { auth: { persistSession: false } });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const rnd = Math.random().toString(36).slice(2, 8);
async function signup(meta) {
  const c = mk();
  const { data, error } = await c.auth.signUp({ email: `${meta.role}${rnd}${Math.random().toString(36).slice(2, 5)}@test.it`, password: 'Password123!', options: { data: meta } });
  if (error) throw error;
  return { c, id: data.user.id };
}
// FN_URL permette di provare la funzione avviata direttamente con Deno (senza `supabase functions serve`).
const FN = process.env.FN_URL || `${URL}/functions/v1/draft-program`;
async function draft(who, body) {
  const token = who ? (await who.c.auth.getSession()).data.session?.access_token : null;
  const res = await fetch(FN, { method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const A = await signup({ role: 'trainer', full_name: 'Coach A' });
const B = await signup({ role: 'trainer', full_name: 'Coach B' });
const { data: inv } = await A.c.from('client_invites').insert({ full_name: 'Mario Segreto' }).select().single();
const C = await signup({ role: 'client', full_name: 'Mario Segreto', invite_code: inv.code });
await A.c.from('clients').update({ goal: 'Ipertrofia', sex: 'M', height_cm: 178, birth_date: '1992-03-10' }).eq('id', C.id);
await A.c.from('client_notes').update({ notes: 'Vecchio infortunio spalla dx' }).eq('client_id', C.id);

// scheda precedente con storico di 4 settimane: panca in crescita, squat fermo
const { data: lib } = await A.c.from('exercises').select('id,name');
const ex = n => lib.find(e => e.name === n).id;
const { data: prog } = await A.c.from('programs').insert({ client_id: C.id, name: 'Ipertrofia 1', weeks: 4 }).select().single();
const { data: w } = await A.c.from('workouts').insert({ program_id: prog.id, name: 'Giorno A' }).select().single();
const { data: wex } = await A.c.from('workout_exercises').insert([
  { workout_id: w.id, exercise_id: ex('Panca piana bilanciere'), position: 0, sets: 3, reps: '8', load: '60kg' },
  { workout_id: w.id, exercise_id: ex('Squat bilanciere'), position: 1, sets: 3, reps: '8', load: '80kg' },
]).select();
const start = new Date(Date.now() - 27 * 86400000);
await A.c.from('programs').update({ status: 'active', sent_at: start.toISOString(), start_date: start.toISOString().slice(0, 10) }).eq('id', prog.id);
for (let wk = 0; wk < 4; wk++) {
  const at = new Date(start.getTime() + wk * 7 * 86400000 + 3600000).toISOString();
  const { data: log } = await C.c.from('workout_logs').insert({ program_id: prog.id, workout_id: w.id, workout_name: 'Giorno A', week: wk + 1, started_at: at, completed_at: at }).select().single();
  const rows = [];
  for (let s = 1; s <= 3; s++) {
    rows.push({ log_id: log.id, workout_exercise_id: wex[0].id, exercise_id: wex[0].exercise_id, exercise_name: 'Panca piana bilanciere', set_number: s, reps: 8, load: 60 + wk * 2.5 });
    rows.push({ log_id: log.id, workout_exercise_id: wex[1].id, exercise_id: wex[1].exercise_id, exercise_name: 'Squat bilanciere', set_number: s, reps: 8, load: 80 });
  }
  await C.c.from('set_logs').insert(rows);
}
await C.c.from('program_reviews').insert({ program_id: prog.id, program_name: prog.name, overall: 4, difficulty: 3, adherence: 5, adherence_pct: 100,
  stressors: ['Lavoro'], pain: 'Fastidio spalla destra', next_goal: 'Forza panca e gambe', days_per_week: 2, session_minutes: 60 });

// ── analisi per gruppo muscolare
const { data: mg, error: mge } = await A.c.rpc('muscle_group_progress', { p_client: C.id });
const petto = mg?.find(g => g.muscle_group === 'Petto'), gambe = mg?.find(g => g.muscle_group === 'Gambe');
ok(!mge && petto?.sets === 12 && Number(petto.sets_per_week) === 3, `volume petto: ${petto?.sets} serie, ${petto?.sets_per_week}/sett ${mge?.message || ''}`);
ok(Number(petto?.strength_change_pct) > 8 && Number(petto?.strength_change_pct) < 12, `forza petto in crescita: ${petto?.strength_change_pct}%`);
ok(Number(gambe?.strength_change_pct) === 0, `forza gambe ferma: ${gambe?.strength_change_pct}%`);
ok((await B.c.rpc('muscle_group_progress', { p_client: C.id })).data.length === 0, 'B non vede l\'analisi di un cliente di A');
ok((await C.c.rpc('muscle_group_progress', { p_client: C.id })).data.length === 2, 'il cliente vede la propria analisi');

// ── bozza AI
const r = await draft(A, { client_id: C.id, instructions: 'Niente esercizi sopra la testa' });
ok(r.status === 200 && r.data?.program_id, 'bozza creata ' + (r.data?.error || ''));
if (r.data?.program_id) {
  const { data: p } = await A.c.from('programs').select('*, workouts(*, workout_exercises(*, exercises(name)))').eq('id', r.data.program_id).single();
  p.workouts.sort((a, b) => a.position - b.position).forEach(x => x.workout_exercises.sort((a, b) => a.position - b.position));
  ok(p.status === 'draft' && p.client_id === C.id && p.trainer_id === A.id, 'salvata come bozza del coach per il cliente');
  ok((await C.c.from('programs').select('id').eq('id', p.id)).data.length === 0, 'il cliente NON vede la bozza');
  const names = p.workouts.map(x => x.workout_exercises.map(e => e.exercises.name));
  console.log('   esercizi:', JSON.stringify(names));
  ok(p.workouts.length >= 1 && p.workouts.every(x => x.workout_exercises.length >= 1), 'giorni ed esercizi presenti');
  const all = p.workouts.flatMap(x => x.workout_exercises);
  ok(all.every(e => e.sets >= 1 && e.sets <= 10 && e.rest_seconds >= 0 && e.rest_seconds <= 600), 'serie e recuperi entro limiti sensati');
  ok(all.every(e => Object.keys(e.week_overrides).every(k => +k >= 2 && +k <= p.weeks)), 'progressione solo su settimane valide');
  const { data: note } = await A.c.from('ai_drafts').select('*').eq('program_id', p.id);
  ok(note.length === 1 && note[0].coach_notes.length > 10 && note[0].output_tokens > 0, 'note per il coach e consumo registrati');
  ok((await C.c.from('ai_drafts').select('id')).data.length === 0, 'il cliente non vede le note per il coach');
  ok((await B.c.from('ai_drafts').select('id')).data.length === 0, 'B non vede le note di A');
  ok(!!(await A.c.from('ai_drafts').insert({ trainer_id: A.id })).error, 'il coach non può alterare il conteggio');
}
// ── accessi
const rb = await draft(B, { client_id: C.id });
ok(rb.status === 404, 'B non può generare bozze per un cliente di A');
const rc = await draft(C, { client_id: C.id });
ok(rc.status === 403, 'il cliente non può usare la funzione');
const ra = await draft(null, { client_id: C.id });
ok(ra.status === 401, 'senza login: rifiutato');
// ── limite mensile (prova gratuita: 3)
await draft(A, { client_id: C.id }); await draft(A, { client_id: C.id });
const r4 = await draft(A, { client_id: C.id });
ok(r4.status === 429, 'quarta bozza del mese rifiutata: ' + r4.data?.error);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);

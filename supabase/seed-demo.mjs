// Dati dimostrativi: un coach con tre clienti in situazioni diverse.
//   ANON=<anon key> [SUPABASE_URL=...] node supabase/seed-demo.mjs
// Accessi creati (password: demo1234):  coach@demo.it · mario@demo.it · giulia@demo.it
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321', ANON = process.env.ANON;
const PASSWORD = 'demo1234';
const DAY = 86400000;
const mk = () => createClient(URL, ANON, { auth: { persistSession: false } });
const must = r => { if (r.error) throw new Error(r.error.message); return r.data; };
const ago = (days, hours = 18) => { const d = new Date(Date.now() - days * DAY); d.setHours(hours, 30, 0, 0); return d.toISOString(); };

async function signup(email, meta) {
  const c = mk();
  const { data, error } = await c.auth.signUp({ email, password: PASSWORD, options: { data: meta } });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, id: data.user.id };
}

const coach = await signup('coach@demo.it', { role: 'trainer', full_name: 'Luca Spino', business_name: 'Spino Coaching' });
const invite = async name => must(await coach.c.from('client_invites').insert({ full_name: name }).select().single()).code;
const mario = await signup('mario@demo.it', { role: 'client', full_name: 'Mario Rossi', invite_code: await invite('Mario Rossi') });
const giulia = await signup('giulia@demo.it', { role: 'client', full_name: 'Giulia Bianchi', invite_code: await invite('Giulia Bianchi') });
const andrea = await signup('andrea@demo.it', { role: 'client', full_name: 'Andrea Verdi', invite_code: await invite('Andrea Verdi') });
await invite('Sara Neri'); // invito ancora in attesa

await coach.c.from('clients').update({ goal: 'Ipertrofia e forza sulla panca', sex: 'M', height_cm: 178, birth_date: '1992-03-10' }).eq('id', mario.id);
await coach.c.from('clients').update({ goal: 'Dimagrimento e tonificazione', sex: 'F', height_cm: 165, birth_date: '1996-07-22' }).eq('id', giulia.id);
await coach.c.from('clients').update({ goal: 'Rimettersi in forma', sex: 'M', height_cm: 182 }).eq('id', andrea.id);
await coach.c.from('client_notes').update({ notes: 'Vecchio infortunio alla spalla destra (2022). Lavora in ufficio, si allena la sera. Abbonamento trimestrale.' }).eq('client_id', mario.id);

const lib = must(await coach.c.from('exercises').select('id, name'));
const ex = n => { const e = lib.find(x => x.name === n); if (!e) throw new Error('Esercizio mancante: ' + n); return e.id; };

/** Crea una scheda con giorni ed esercizi: days = [{ name, notes, ex: [[nome, serie, rip, carico, recupero, extra]] }] */
async function program(clientId, name, description, weeks, days, startedDaysAgo) {
  const p = must(await coach.c.from('programs').insert({ client_id: clientId, name, description, weeks }).select().single());
  const out = [];
  for (const [i, d] of days.entries()) {
    const w = must(await coach.c.from('workouts').insert({ program_id: p.id, name: d.name, position: i, notes: d.notes ?? '' }).select().single());
    const rows = d.ex.map(([n, sets, reps, load, rest, extra], k) => ({
      workout_id: w.id, exercise_id: ex(n), position: k, sets, reps, load: load ?? '', rest_seconds: rest ?? 90,
      notes: '', superset: '', week_overrides: {}, ...(extra ?? {}),
    }));
    out.push({ workout: w, exercises: must(await coach.c.from('workout_exercises').insert(rows).select()).sort((a, b) => a.position - b.position), spec: d.ex });
  }
  if (startedDaysAgo != null) {
    await coach.c.from('programs').update({ status: 'active', sent_at: ago(startedDaysAgo, 9), start_date: ago(startedDaysAgo).slice(0, 10) }).eq('id', p.id);
  }
  return { id: p.id, name, days: out };
}

/** Registra un allenamento completato. loads = kg per esercizio (stesso ordine della scheda). */
async function logWorkout(client, prog, dayIdx, week, daysAgo, loads, feeling, notes = '') {
  const d = prog.days[dayIdx];
  const at = ago(daysAgo);
  const log = must(await client.c.from('workout_logs').insert({
    program_id: prog.id, workout_id: d.workout.id, workout_name: d.workout.name, week, started_at: at,
    completed_at: new Date(new Date(at).getTime() + 62 * 60000).toISOString(), feeling, notes,
  }).select().single());
  const rows = [];
  d.exercises.forEach((e, i) => {
    const reps = parseInt(String(e.reps), 10) || 10;
    for (let s = 1; s <= e.sets; s++) {
      rows.push({ log_id: log.id, workout_exercise_id: e.id, exercise_id: e.exercise_id, exercise_name: d.spec[i][0],
        set_number: s, reps: s === e.sets ? reps - 1 : reps, load: loads[i] ?? null });
    }
  });
  must(await client.c.from('set_logs').insert(rows));
  return log;
}

// ── MARIO: scheda quasi finita, costante, panca in crescita, squat fermo ──────
const pm = await program(mario.id, 'Ipertrofia - Blocco 1', 'Quattro settimane di volume: cura la tecnica e aumenta il carico solo quando chiudi tutte le serie.', 4, [
  { name: 'Giorno A - Spinta', notes: 'Riscaldamento: 10 min cyclette + 2 serie leggere di panca', ex: [
    ['Panca piana bilanciere', 4, '8', '60kg', 150, { notes: 'Scapole addotte, fermo al petto', week_overrides: { 3: { reps: '6', load: '65kg' }, 4: { reps: '6', load: '67,5kg' } } }],
    ['Panca inclinata manubri', 3, '10', '22kg', 90],
    ['Alzate laterali', 3, '15', '8kg', 60, { superset: 'A' }],
    ['Pushdown ai cavi', 3, '12', '25kg', 60, { superset: 'A' }] ] },
  { name: 'Giorno B - Gambe', ex: [
    ['Squat bilanciere', 4, '8', '80kg', 180],
    ['Leg press', 3, '12', '140kg', 120],
    ['Leg curl sdraiato', 3, '12', '35kg', 75],
    ['Calf raise in piedi', 3, '15', '60kg', 60] ] },
  { name: 'Giorno C - Trazione', ex: [
    ['Lat machine avanti', 4, '10', '55kg', 90],
    ['Rematore manubrio', 3, '10', '26kg', 90],
    ['Face pull', 3, '15', '18kg', 60],
    ['Curl bilanciere', 3, '10', '30kg', 75] ] },
], 24);
const marioLoads = [   // [A, B, C] per settimana
  [[60, 22, 8, 25], [80, 140, 35, 60], [55, 26, 18, 30]],
  [[62.5, 22, 8, 27.5], [80, 145, 35, 60], [57.5, 26, 18, 30]],
  [[65, 24, 9, 27.5], [80, 150, 37.5, 65], [60, 28, 20, 32.5]],
  [[67.5, 24, 9, 30], [80, 150, 37.5, 65], null],
];
let lastLog;
for (let w = 0; w < 4; w++) for (let d = 0; d < 3; d++) {
  if (!marioLoads[w][d]) continue;
  const daysAgo = 24 - w * 7 - d * 2 - 1;
  if (daysAgo < 0) continue;
  lastLog = await logWorkout(mario, pm, d, w + 1, daysAgo, marioLoads[w][d], w === 3 ? 5 : 4,
    w === 3 && d === 0 ? 'Panca volata, 67,5 per 6 puliti. Spalla ok.' : '');
}
await coach.c.from('workout_logs').update({ trainer_comment: 'Ottima progressione sulla panca! Sullo squat resta a 80 e cura la profondità.' }).eq('id', lastLog.id);
for (const [daysAgo, weight, waist, energy] of [[24, 79.8, 86, 3], [17, 79.4, 85.5, 4], [10, 79.1, 85, 4], [3, 78.6, 84, 5]]) {
  must(await mario.c.from('check_ins').insert({ date: ago(daysAgo).slice(0, 10), created_at: ago(daysAgo, 8), weight, waist, sleep: 4, energy, stress: 2, adherence: 5,
    notes: daysAgo === 3 ? 'Mi sento più forte, la cintura è più larga.' : '' }));
}
await coach.c.from('check_ins').update({ reviewed_at: ago(9), trainer_feedback: 'Bene così, il peso scende piano e la forza sale: è quello che vogliamo.' })
  .eq('client_id', mario.id).lt('date', ago(5).slice(0, 10));
await coach.c.from('programs').update({ review_requested_at: ago(2, 9) }).eq('id', pm.id);
must(await mario.c.from('program_reviews').insert({
  program_id: pm.id, program_name: pm.name, created_at: ago(1, 21), overall: 5, difficulty: 3, adherence: 5, adherence_pct: 92, results: 4, duration_ok: 3,
  stressors: ['Lavoro'], liked: 'Il giorno A e le superserie finali', disliked: 'Leg press dopo lo squat mi distrugge',
  pain: 'Leggero fastidio alla spalla destra sulle alzate laterali pesanti', next_goal: 'Più forza su panca e squat, mantenendo il peso',
  days_per_week: 4, session_minutes: 75, notes: 'Da gennaio posso allenarmi anche il sabato mattina.',
}));
for (const [who, daysAgo, hours, body, read] of [
  [mario, 6, 20, 'Coach, sulla panca posso salire a 67,5 la prossima?', true],
  [coach, 6, 21, 'Sì, se chiudi tutte le serie da 6 pulite. Fermo al petto!', true],
  [mario, 3, 19, 'Fatto, 67,5 per 6 🔥', true],
  [coach, 3, 20, 'Grande Mario! Ti ho chiesto il questionario di fine scheda, compilalo quando puoi.', true],
  [mario, 0, 8, 'Compilato! Quando arriva la nuova scheda?', false],
]) {
  must(await who.c.from('messages').insert({ client_id: mario.id, body, created_at: ago(daysAgo, hours), read_at: read ? ago(daysAgo, hours + 1) : null }));
}

// ── GIULIA: scheda iniziata da 16 giorni, poca costanza, check-in da vedere ───
const pg = await program(giulia.id, 'Tonificazione - Fase 1', 'Tre sedute a settimana, circuito finale per alzare il battito.', 6, [
  { name: 'Giorno A - Gambe e glutei', ex: [['Hip thrust bilanciere', 4, '10', '50kg', 120], ['Goblet squat', 3, '12', '14kg', 90], ['Affondi manubri', 3, '10', '8kg', 90], ['Plank', 3, '40s', '', 45]] },
  { name: 'Giorno B - Parte alta', ex: [['Lat machine avanti', 3, '12', '30kg', 90], ['Chest press', 3, '12', '20kg', 90], ['Alzate laterali', 3, '15', '4kg', 60], ['Crunch', 3, '20', '', 45]] },
  { name: 'Giorno C - Total body', ex: [['Stacco rumeno', 3, '10', '35kg', 120], ['Step-up', 3, '12', '6kg', 75], ['Kettlebell swing', 3, '15', '12kg', 60]] },
], 16);
await logWorkout(giulia, pg, 0, 1, 15, [50, 14, 8, null], 4);
await logWorkout(giulia, pg, 1, 1, 13, [30, 20, 4, null], 3);
await logWorkout(giulia, pg, 0, 2, 9, [52.5, 14, 8, null], 2, 'Settimana pesante al lavoro, ero stanchissima.');
must(await giulia.c.from('check_ins').insert({ date: ago(1).slice(0, 10), created_at: ago(1, 7), weight: 63.2, waist: 72, hips: 98, sleep: 2, energy: 2, stress: 4, adherence: 2,
  notes: 'Periodo no: dormo poco e ho saltato quasi tutti gli allenamenti. Possiamo accorciare le sedute?' }));
must(await giulia.c.from('messages').insert({ client_id: giulia.id, body: 'Ciao coach, scusa se sono sparita. Ti ho scritto nel check-in.', created_at: ago(1, 7) }));

// ── Un modello riutilizzabile ─────────────────────────────────────────────────
const tpl = must(await coach.c.from('programs').insert({ name: 'Full body principiante', description: 'Tre sedute uguali a settimana per imparare i movimenti base.', weeks: 6 }).select().single());
const tw = must(await coach.c.from('workouts').insert({ program_id: tpl.id, name: 'Full body', position: 0 }).select().single());
must(await coach.c.from('workout_exercises').insert([
  ['Goblet squat', 3, '12'], ['Chest press', 3, '12'], ['Lat machine avanti', 3, '12'], ['Hip thrust bilanciere', 3, '12'], ['Plank', 3, '30s'],
].map(([n, sets, reps], i) => ({ workout_id: tw.id, exercise_id: ex(n), position: i, sets, reps }))));

console.log('Dati demo creati. Accessi (password demo1234): coach@demo.it · mario@demo.it · giulia@demo.it · andrea@demo.it');

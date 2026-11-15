// Bozza AI della scheda successiva.
// Il coach la richiede per un suo cliente; la funzione raccoglie questionario di fine scheda,
// storico allenamenti, analisi per gruppo muscolare e check-in, chiede a Claude una proposta
// e la salva come BOZZA (il cliente non la vede finché il coach non la invia).
//
// Segreti richiesti:  ANTHROPIC_API_KEY   (supabase secrets set ANTHROPIC_API_KEY=...)

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/beta/zod';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

const MODEL = 'claude-opus-5-5';

// Bozze AI al mese per piano
const MONTHLY_LIMIT: Record<string, number> = { trial: 3, starter: 10, pro: 50, studio: 200 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const Draft = z.object({
  name: z.string().describe('Nome breve della scheda, es. "Forza - Blocco 2"'),
  description: z.string().describe('2-3 frasi rivolte al CLIENTE: obiettivo del blocco e come affrontarlo'),
  weeks: z.number().int().describe('Durata in settimane (di solito 4-8)'),
  coach_notes: z.string().describe(
    'Note per il COACH (il cliente non le vede): le scelte principali e da quali dati derivano, ' +
    'cosa è cambiato rispetto alla scheda precedente, e i punti da verificare prima di inviare'),
  workouts: z.array(z.object({
    name: z.string().describe('es. "Giorno A - Spinta"'),
    notes: z.string().describe('Riscaldamento o indicazioni generali della seduta; stringa vuota se non servono'),
    exercises: z.array(z.object({
      exercise: z.number().int().describe('Numero dell\'esercizio nella libreria'),
      sets: z.number().int(),
      reps: z.string().describe('es. "8-10", "5", "12/10/8", "30s"'),
      load: z.string().describe('Carico della settimana 1, es. "62,5kg", "RPE 8"; stringa vuota se libero'),
      rest_seconds: z.number().int(),
      superset: z.string().describe('Lettera (A, B…) condivisa dagli esercizi in superserie; stringa vuota altrimenti'),
      notes: z.string().describe('Indicazione tecnica breve per il cliente; stringa vuota se non serve'),
      progression: z.array(z.object({
        week: z.number().int(),
        sets: z.number().int(),
        reps: z.string(),
        load: z.string(),
      })).describe('Solo le settimane (dalla 2 in poi) in cui serie, ripetizioni o carico cambiano rispetto alla settimana 1'),
    })),
  })),
});
type DraftT = z.infer<typeof Draft>;

const SYSTEM = `Sei l'assistente di un personal trainer professionista. Prepari la BOZZA della prossima scheda di allenamento di un suo cliente. Il coach la rivedrà, la correggerà e deciderà se inviarla: tu gli fai risparmiare tempo proponendo una base solida e motivata dai dati, non prendi decisioni al posto suo.

Riceverai i dati del cliente: obiettivo, note private del coach, l'ultimo questionario di fine scheda, la scheda precedente, l'analisi per gruppo muscolare (volume settimanale e andamento della forza), le prestazioni recenti per esercizio, l'aderenza e gli ultimi check-in.

Come ragionare:
- Parti dall'obiettivo dichiarato per il prossimo periodo e dalla disponibilità reale (giorni a settimana, minuti per seduta). Una scheda che il cliente non riesce a seguire non serve: se l'aderenza è stata bassa o ci sono fattori di stress esterni, riduci volume e complessità invece di aumentarli.
- Usa l'analisi per gruppo muscolare: dove la forza è ferma o in calo valuta se cambiare stimolo (esercizio, intervallo di ripetizioni, volume); dove il volume è scarso rispetto all'obiettivo, aumentalo con gradualità; dove i progressi sono buoni, mantieni ciò che funziona.
- Dolori e fastidi segnalati hanno la precedenza: evita o sostituisci i movimenti che li provocano e scrivilo nelle note per il coach. Non fare diagnosi e non dare indicazioni mediche.
- Tieni conto di cosa è piaciuto e di cosa il cliente vorrebbe cambiare: il gradimento sostiene l'aderenza.
- Imposta i carichi della settimana 1 a partire dalle prestazioni recenti dello stesso esercizio. Se per un esercizio non ci sono dati, lascia il carico vuoto o indica un RPE.
- Prevedi una progressione sulle settimane coerente con l'obiettivo.
- Se i dati sono pochi (cliente nuovo, nessun questionario), proponi una scheda prudente e dillo nelle note per il coach.

Usa solo esercizi della libreria qui sotto, indicandoli con il loro numero. I testi per il cliente sono in italiano, chiari e brevi.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    // Client con l'identità del coach: tutte le letture e scritture rispettano le regole di accesso.
    const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user } } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!user) return json({ error: 'Non autenticato' }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id ?? '');
    const instructions = String(body.instructions ?? '').slice(0, 2000);
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json({ error: 'Cliente non valido' }, 400);

    const { data: trainer } = await db.from('trainers').select('id, plan').eq('id', user.id).maybeSingle();
    if (!trainer) return json({ error: 'Funzione riservata ai coach' }, 403);
    const { data: client } = await db.from('clients').select('id, goal, sex, birth_date, height_cm').eq('id', clientId).maybeSingle();
    if (!client) return json({ error: 'Cliente non trovato' }, 404);

    // Limite mensile del piano
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count: used } = await admin.from('ai_drafts').select('id', { count: 'exact', head: true })
      .eq('trainer_id', user.id).gte('created_at', monthStart.toISOString());
    const limit = MONTHLY_LIMIT[trainer.plan] ?? 0;
    if ((used ?? 0) >= limit) {
      return json({ error: `Hai usato tutte le ${limit} bozze AI di questo mese incluse nel tuo piano.` }, 429);
    }

    const { library, context } = await gatherContext(db, clientId, client);
    if (library.length === 0) return json({ error: 'Libreria esercizi vuota' }, 400);

    const libraryText = library.map((e, i) => `${i + 1}. ${e.name} — ${e.muscle_group || 'Altro'}${e.equipment ? `, ${e.equipment}` : ''}`).join('\n');
    const anthropic = new Anthropic({ timeout: 140_000, maxRetries: 1 });

    const message = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',                     // se la richiesta viene rifiutata per errore, riprova su un modello di riserva
      output_config: { effort: 'high', format: betaZodOutputFormat(Draft) },
      system: [
        { type: 'text', text: SYSTEM },
        // La libreria è uguale a ogni richiesta dello stesso coach: in cache costa molto meno.
        { type: 'text', text: `LIBRERIA ESERCIZI\n${libraryText}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{
        role: 'user',
        content:
          `Dati del cliente (JSON):\n${JSON.stringify(context, null, 1)}\n\n` +
          (instructions ? `Indicazioni del coach per questa scheda (hanno la precedenza):\n${instructions}\n\n` : '') +
          'Prepara la bozza della prossima scheda.',
      }],
    });

    if (message.stop_reason === 'refusal') return json({ error: 'L\'AI non ha potuto elaborare questa richiesta. Riprova modificando le indicazioni.' }, 422);
    if (message.stop_reason === 'max_tokens' || !message.parsed_output) return json({ error: 'La bozza generata era incompleta. Riprova.' }, 502);

    const programId = await saveDraft(db, clientId, message.parsed_output, library);
    await admin.from('ai_drafts').insert({
      trainer_id: user.id, client_id: clientId, program_id: programId,
      coach_notes: message.parsed_output.coach_notes,
      input_tokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0),
      output_tokens: message.usage.output_tokens,
    });
    return json({ program_id: programId, remaining: limit - (used ?? 0) - 1 });
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'Chiave AI non configurata correttamente sul server.' }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Servizio AI momentaneamente occupato. Riprova tra un minuto.' }, 503);
    if (e instanceof Anthropic.APIConnectionError) return json({ error: 'L\'AI non ha risposto in tempo. Riprova.' }, 504);
    if (e instanceof Anthropic.APIError) return json({ error: 'Errore del servizio AI. Riprova più tardi.' }, 502);
    return json({ error: 'Errore imprevisto durante la creazione della bozza.' }, 500);
  }
});

interface LibraryExercise { id: string; name: string; muscle_group: string; equipment: string }

/** Raccoglie tutto ciò che serve all'AI. Non include nome, email o foto del cliente. */
async function gatherContext(db: SupabaseClient, clientId: string, client: Record<string, unknown>) {
  const since = new Date(Date.now() - 10 * 7 * 86400000).toISOString();
  const [lib, notes, review, program, groups, sets, checkins] = await Promise.all([
    db.from('exercises').select('id, name, muscle_group, equipment').order('name').order('id'),
    db.from('client_notes').select('notes').eq('client_id', clientId).maybeSingle(),
    db.from('program_reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
    db.from('programs').select('id, name, weeks, start_date, sent_at, workouts(id, name, position, notes, workout_exercises(position, sets, reps, load, rest_seconds, superset, week_overrides, exercises(name, muscle_group)))')
      .eq('client_id', clientId).neq('status', 'draft').order('sent_at', { ascending: false }).limit(1),
    db.rpc('muscle_group_progress', { p_client: clientId, p_since: since }),
    db.from('set_logs').select('exercise_name, reps, load, workout_logs!inner(started_at, completed_at, client_id, program_id)')
      .eq('workout_logs.client_id', clientId).not('workout_logs.completed_at', 'is', null).gte('workout_logs.started_at', since)
      .eq('done', true).limit(3000),
    db.from('check_ins').select('date, weight, body_fat, waist, sleep, energy, stress, adherence, notes')
      .eq('client_id', clientId).order('date', { ascending: false }).limit(6),
  ]);

  // Prestazioni per esercizio: serie migliore della prima e dell'ultima seduta del periodo
  type Row = { exercise_name: string; reps: number | null; load: number | null; workout_logs: { started_at: string; program_id: string | null } };
  const byEx = new Map<string, Map<string, { load: number; reps: number; e1rm: number }>>();
  const sessions = new Set<string>();
  const lastProgram = (program.data ?? [])[0] as Record<string, any> | undefined;
  for (const s of (sets.data ?? []) as unknown as Row[]) {
    if (lastProgram && s.workout_logs.program_id === lastProgram.id) sessions.add(s.workout_logs.started_at);
    if (!s.load || !s.reps) continue;
    const day = s.workout_logs.started_at;
    const e1rm = Number(s.load) * (1 + Math.min(Number(s.reps), 12) / 30);
    const m = byEx.get(s.exercise_name) ?? new Map();
    if (!m.has(day) || m.get(day)!.e1rm < e1rm) m.set(day, { load: Number(s.load), reps: Number(s.reps), e1rm });
    byEx.set(s.exercise_name, m);
  }
  const performance = [...byEx.entries()].map(([name, days]) => {
    const ordered = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const first = ordered[0]![1], last = ordered[ordered.length - 1]![1];
    return {
      esercizio: name, sedute: ordered.length,
      prima_seduta: `${first.load}kg x ${first.reps}`,
      ultima_seduta: `${last.load}kg x ${last.reps}`,
      massimale_stimato_kg: Math.round(last.e1rm),
    };
  });

  let aderenza: number | null = null;
  if (lastProgram) {
    const perWeek = (lastProgram.workouts ?? []).length;
    const start = lastProgram.start_date ?? lastProgram.sent_at;
    if (perWeek && start) {
      const elapsed = Math.min(lastProgram.weeks, Math.max(1, Math.ceil((Date.now() - new Date(start).getTime()) / (7 * 86400000))));
      aderenza = Math.min(100, Math.round((sessions.size / (perWeek * elapsed)) * 100));
    }
  }

  const r = (review.data ?? [])[0] as Record<string, any> | undefined;
  const age = client.birth_date ? Math.floor((Date.now() - new Date(String(client.birth_date)).getTime()) / (365.25 * 86400000)) : null;

  const context = {
    cliente: { sesso: client.sex ?? null, eta: age, altezza_cm: client.height_cm ?? null, obiettivo_generale: client.goal || null },
    note_private_del_coach: notes.data?.notes || null,
    questionario_fine_scheda: r ? {
      scheda: r.program_name, soddisfazione_1_5: r.overall,
      difficolta_1_troppo_facile_5_troppo_dura: r.difficulty,
      durata_sedute_1_troppo_corte_5_troppo_lunghe: r.duration_ok,
      risultati_percepiti_1_5: r.results, aderenza_percepita_1_5: r.adherence, aderenza_reale_pct: r.adherence_pct,
      fattori_di_stress_esterni: r.stressors, piaciuto: r.liked || null, da_cambiare: r.disliked || null,
      dolori_o_fastidi: r.pain || null, obiettivo_prossimo_periodo: r.next_goal || null,
      giorni_disponibili_a_settimana: r.days_per_week, minuti_per_seduta: r.session_minutes, altro: r.notes || null,
    } : null,
    scheda_precedente: lastProgram ? {
      nome: lastProgram.name, settimane: lastProgram.weeks, aderenza_reale_pct: aderenza,
      sedute: [...(lastProgram.workouts ?? [])].sort((a, b) => a.position - b.position).map((w: any) => ({
        nome: w.name, note: w.notes || undefined,
        esercizi: [...(w.workout_exercises ?? [])].sort((a, b) => a.position - b.position).map((e: any) => ({
          esercizio: e.exercises?.name, gruppo: e.exercises?.muscle_group, serie: e.sets, ripetizioni: e.reps,
          carico: e.load || undefined, recupero_s: e.rest_seconds, superserie: e.superset || undefined,
          variazioni_settimanali: Object.keys(e.week_overrides ?? {}).length ? e.week_overrides : undefined,
        })),
      })),
    } : null,
    analisi_gruppi_muscolari_ultime_10_settimane: (groups.data ?? []).map((g: any) => ({
      gruppo: g.muscle_group, serie_a_settimana: Number(g.sets_per_week), sedute: g.sessions,
      variazione_forza_pct: g.strength_change_pct === null ? null : Number(g.strength_change_pct),
    })),
    prestazioni_per_esercizio: performance,
    ultimi_check_in: checkins.data ?? [],
  };
  return { library: (lib.data ?? []) as LibraryExercise[], context };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)));

/** Salva la proposta come bozza. Gli esercizi non presenti in libreria vengono scartati. */
async function saveDraft(db: SupabaseClient, clientId: string, d: DraftT, library: LibraryExercise[]) {
  const weeks = clamp(d.weeks, 1, 16);
  const { data: program, error } = await db.from('programs').insert({
    client_id: clientId, name: d.name.trim().slice(0, 80) || 'Bozza AI', description: d.description.trim(), weeks, status: 'draft',
  }).select('id').single();
  if (error) throw error;

  for (const [wi, w] of d.workouts.slice(0, 7).entries()) {
    const { data: workout, error: we } = await db.from('workouts')
      .insert({ program_id: program.id, name: w.name.trim().slice(0, 60) || `Giorno ${wi + 1}`, position: wi, notes: w.notes.trim() })
      .select('id').single();
    if (we) throw we;
    const rows = w.exercises.slice(0, 14).flatMap((e, ei) => {
      const lib = library[e.exercise - 1];
      if (!lib) return [];
      const overrides: Record<string, { sets?: number; reps?: string; load?: string }> = {};
      for (const p of e.progression) {
        if (p.week < 2 || p.week > weeks) continue;
        const o: { sets?: number; reps?: string; load?: string } = {};
        if (clamp(p.sets, 1, 10) !== clamp(e.sets, 1, 10)) o.sets = clamp(p.sets, 1, 10);
        if (p.reps.trim() && p.reps.trim() !== e.reps.trim()) o.reps = p.reps.trim();
        if (p.load.trim() && p.load.trim() !== e.load.trim()) o.load = p.load.trim();
        if (Object.keys(o).length) overrides[String(p.week)] = o;
      }
      return [{
        workout_id: workout.id, exercise_id: lib.id, position: ei,
        sets: clamp(e.sets, 1, 10), reps: e.reps.trim().slice(0, 20) || '10', load: e.load.trim().slice(0, 20),
        rest_seconds: clamp(e.rest_seconds, 0, 600), superset: e.superset.trim().toUpperCase().slice(0, 1),
        notes: e.notes.trim().slice(0, 300), week_overrides: overrides,
      }];
    });
    if (rows.length) {
      const { error: xe } = await db.from('workout_exercises').insert(rows);
      if (xe) throw xe;
    }
  }
  return program.id as string;
}

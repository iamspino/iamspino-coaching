-- ════════════════════════════════════════════════════════════════════════════
--  ANALISI PER GRUPPO MUSCOLARE + BOZZA AI DELLA SCHEDA SUCCESSIVA
-- ════════════════════════════════════════════════════════════════════════════

-- Progressi del cliente per gruppo muscolare nel periodo indicato:
--   volume (serie totali e a settimana), frequenza, e andamento della forza
--   (variazione % del massimale stimato tra le prime e le ultime sedute di ogni esercizio).
-- Rispetta le regole di accesso: la vede il cliente stesso o il suo coach.
create function public.muscle_group_progress(p_client uuid, p_since timestamptz default now() - interval '8 weeks')
returns table (
  muscle_group         text,
  sets                 int,
  sets_per_week        numeric,
  sessions             int,
  exercises            int,
  strength_change_pct  numeric
)
language sql stable security invoker set search_path = public as $$
  with s as (
    select coalesce(nullif(e.muscle_group, ''), 'Altro') as mg,
           sl.exercise_id, wl.id as log_id, wl.started_at,
           case when sl.load > 0 and sl.reps > 0
                then sl.load * (1 + least(sl.reps, 12) / 30.0) end as e1rm   -- Epley, ripetizioni limitate a 12
    from set_logs sl
    join workout_logs wl on wl.id = sl.log_id
    left join exercises e on e.id = sl.exercise_id
    where wl.client_id = p_client and wl.completed_at is not null and sl.done and wl.started_at >= p_since
  ),
  span as (
    select greatest(1, ceil(extract(epoch from (now() - min(started_at))) / 604800.0)) as weeks from s
  ),
  per_session as (
    select mg, exercise_id, log_id, started_at, max(e1rm) as best
    from s where exercise_id is not null group by 1, 2, 3, 4
  ),
  ranked as (
    select *, row_number() over (partition by exercise_id order by started_at) as rn,
              count(*) over (partition by exercise_id) as n
    from per_session where best is not null
  ),
  trend as (
    -- media delle ultime sedute contro media delle prime (1 seduta se poche, 2 se almeno 4)
    select mg, exercise_id,
           (avg(best) filter (where rn > n - least(2, n / 2))
            / nullif(avg(best) filter (where rn <= least(2, n / 2)), 0) - 1) * 100 as pct
    from ranked where n >= 2 group by 1, 2
  ),
  trend_mg as (select mg, round(avg(pct), 1) as pct from trend group by 1)
  select s.mg,
         count(*)::int,
         round(count(*) / (select weeks from span), 1),
         count(distinct s.log_id)::int,
         count(distinct s.exercise_id)::int,
         t.pct
  from s left join trend_mg t on t.mg = s.mg
  group by s.mg, t.pct
  order by count(*) desc;
$$;

-- Registro delle bozze generate dall'AI: note per il coach (mai visibili al cliente)
-- e conteggio mensile per i limiti del piano. Scrive solo il server.
create table public.ai_drafts (
  id             uuid primary key default gen_random_uuid(),
  trainer_id     uuid not null references public.trainers on delete cascade,
  client_id      uuid references public.clients on delete set null,
  program_id     uuid references public.programs on delete set null,   -- il conteggio resta anche se la scheda viene eliminata
  coach_notes    text not null default '',
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  created_at     timestamptz not null default now()
);
create index on public.ai_drafts (trainer_id, created_at desc);
create index on public.ai_drafts (program_id);

alter table public.ai_drafts enable row level security;
create policy "ai_drafts_trainer_select" on public.ai_drafts for select using (trainer_id = auth.uid());

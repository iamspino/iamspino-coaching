-- ════════════════════════════════════════════════════════════════════════════
--  QUESTIONARIO DI FINE PROGRAMMAZIONE
--  Il cliente lo compila a fine scheda (o quando il coach lo richiede).
--  Resta nella cartella del cliente anche se la scheda viene eliminata,
--  così il coach lo ha davanti quando prepara la scheda successiva.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.programs add column review_requested_at timestamptz;

create table public.program_reviews (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null default auth.uid() references public.clients on delete cascade,
  program_id       uuid references public.programs on delete set null,
  program_name     text not null default '',
  overall          int check (overall between 1 and 5),         -- soddisfazione generale
  difficulty       int check (difficulty between 1 and 5),      -- 1 troppo facile … 5 troppo dura
  enjoyment        int check (enjoyment between 1 and 5),       -- quanto è piaciuta
  results          int check (results between 1 and 5),         -- risultati percepiti
  duration_ok      int check (duration_ok between 1 and 5),     -- 1 sedute troppo corte … 5 troppo lunghe
  liked            text not null default '',                    -- esercizi/aspetti preferiti
  disliked         text not null default '',                    -- esercizi da togliere o cambiare
  pain             text not null default '',                    -- dolori o fastidi
  next_goal        text not null default '',                    -- obiettivo per la prossima scheda
  days_per_week    int check (days_per_week between 1 and 7),   -- disponibilità prossimo periodo
  session_minutes  int check (session_minutes between 10 and 240),
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  unique (program_id)
);
create index on public.program_reviews (client_id, created_at desc);

alter table public.program_reviews enable row level security;

create policy "reviews_client" on public.program_reviews for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and (program_id is null or can_view_program(program_id)));
create policy "reviews_trainer_select" on public.program_reviews for select
  using (is_trainer_of(client_id));

-- Notifica al coach quando arriva un questionario
create function public.notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_trainer uuid; v_name text;
begin
  select c.trainer_id, p.full_name into v_trainer, v_name
  from clients c join profiles p on p.id = c.id where c.id = new.client_id;
  perform send_push(v_trainer, 'Questionario di fine scheda 📋',
                    coalesce(v_name, 'Un cliente') || ' ha compilato il questionario di ' || new.program_name,
                    jsonb_build_object('type', 'review', 'clientId', new.client_id, 'reviewId', new.id));
  return new;
end $$;
create trigger reviews_push after insert on public.program_reviews
  for each row execute function public.notify_review();

-- Notifica al cliente quando il coach richiede il questionario
create function public.notify_review_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null and new.review_requested_at is not null
     and new.review_requested_at is distinct from old.review_requested_at then
    perform send_push(new.client_id, 'Com''è andata la scheda? 📋',
                      'Il tuo coach ti chiede un feedback su ' || new.name || ' per preparare la prossima',
                      jsonb_build_object('type', 'review_request', 'programId', new.id));
  end if;
  return new;
end $$;
create trigger programs_review_request_push after update on public.programs
  for each row execute function public.notify_review_request();

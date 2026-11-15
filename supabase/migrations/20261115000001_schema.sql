-- ════════════════════════════════════════════════════════════════════════════
--  Piattaforma coaching multi-trainer
--  Ogni trainer vede SOLO i propri clienti; ogni cliente vede SOLO i propri dati.
--  La sicurezza è garantita dal database (Row Level Security), non dall'app.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── PROFILI ──────────────────────────────────────────────────────────────────
create type public.user_role as enum ('trainer', 'client');

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        public.user_role not null,
  full_name   text not null default '',
  avatar_url  text,
  push_token  text,
  created_at  timestamptz not null default now()
);

create table public.trainers (
  id             uuid primary key references public.profiles on delete cascade,
  business_name  text not null default '',
  plan           text not null default 'trial' check (plan in ('trial', 'starter', 'pro', 'studio')),
  max_clients    int  not null default 10,
  trial_ends_at  timestamptz not null default now() + interval '30 days',
  created_at     timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key references public.profiles on delete cascade,
  trainer_id  uuid not null references public.trainers on delete cascade,
  status      text not null default 'active' check (status in ('active', 'paused', 'archived')),
  goal        text not null default '',
  birth_date  date,
  height_cm   numeric,
  sex         text check (sex in ('M', 'F', 'altro')),
  created_at  timestamptz not null default now()
);
create index on public.clients (trainer_id);

-- Note private del trainer: tabella separata così il cliente non può leggerle.
create table public.client_notes (
  client_id   uuid primary key references public.clients on delete cascade,
  trainer_id  uuid not null references public.trainers on delete cascade,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);

create table public.client_invites (
  code         text primary key default upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8)),
  trainer_id   uuid not null default auth.uid() references public.trainers on delete cascade,
  full_name    text not null default '',
  email        text,
  created_at   timestamptz not null default now(),
  accepted_by  uuid references public.clients on delete set null,
  accepted_at  timestamptz
);
create index on public.client_invites (trainer_id);

-- ── ESERCIZI ─────────────────────────────────────────────────────────────────
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid references public.trainers on delete cascade,  -- null = libreria comune
  name          text not null check (length(trim(name)) > 0),
  muscle_group  text not null default '',
  equipment     text not null default '',
  video_url     text,
  instructions  text not null default '',
  created_at    timestamptz not null default now()
);
create index on public.exercises (trainer_id);

-- ── PROGRAMMI (SCHEDE) ───────────────────────────────────────────────────────
create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null default auth.uid() references public.trainers on delete cascade,
  client_id    uuid references public.clients on delete cascade,     -- null = modello
  name         text not null check (length(trim(name)) > 0),
  description  text not null default '',
  weeks        int  not null default 4 check (weeks between 1 and 52),
  status       text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  start_date   date,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.programs (trainer_id);
create index on public.programs (client_id);

create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs on delete cascade,
  name        text not null default 'Allenamento',
  position    int  not null default 0,
  notes       text not null default ''
);
create index on public.workouts (program_id);

create table public.workout_exercises (
  id              uuid primary key default gen_random_uuid(),
  workout_id      uuid not null references public.workouts on delete cascade,
  exercise_id     uuid not null references public.exercises on delete restrict,
  position        int  not null default 0,
  superset        text not null default '',      -- es. "A": esercizi con stessa lettera = superserie
  sets            int  not null default 3 check (sets between 1 and 20),
  reps            text not null default '10',    -- testo libero: "8-10", "12/10/8", "30s"
  load            text not null default '',      -- "60kg", "RPE 8", "70%"
  rest_seconds    int  not null default 90 check (rest_seconds between 0 and 900),
  tempo           text not null default '',
  notes           text not null default '',
  -- variazioni per settimana: {"2": {"sets": 4, "reps": "8", "load": "65kg"}, ...}
  week_overrides  jsonb not null default '{}'::jsonb
);
create index on public.workout_exercises (workout_id);

-- ── DIARIO ALLENAMENTI ───────────────────────────────────────────────────────
create table public.workout_logs (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null default auth.uid() references public.clients on delete cascade,
  program_id       uuid references public.programs on delete set null,
  workout_id       uuid references public.workouts on delete set null,
  workout_name     text not null default '',
  week             int  not null default 1,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  feeling          int  check (feeling between 1 and 5),
  notes            text not null default '',
  trainer_comment  text not null default ''
);
create index on public.workout_logs (client_id, started_at desc);

create table public.set_logs (
  id                   uuid primary key default gen_random_uuid(),
  log_id               uuid not null references public.workout_logs on delete cascade,
  workout_exercise_id  uuid references public.workout_exercises on delete set null,
  exercise_id          uuid references public.exercises on delete set null,
  exercise_name        text not null default '',
  set_number           int  not null,
  reps                 numeric,
  load                 numeric,
  done                 boolean not null default true,
  unique (log_id, workout_exercise_id, set_number)
);
create index on public.set_logs (log_id);
create index on public.set_logs (exercise_id);

-- ── CHAT ─────────────────────────────────────────────────────────────────────
-- Una conversazione per cliente (cliente ↔ il suo trainer).
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients on delete cascade,
  sender_id   uuid not null default auth.uid() references public.profiles on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index on public.messages (client_id, created_at desc);

-- ── CHECK-IN E PROGRESSI ─────────────────────────────────────────────────────
create table public.check_ins (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null default auth.uid() references public.clients on delete cascade,
  date              date not null default current_date,
  weight            numeric check (weight between 20 and 400),
  body_fat          numeric check (body_fat between 2 and 70),
  waist             numeric, hips numeric, chest numeric, arm numeric, thigh numeric,
  sleep             int check (sleep between 1 and 5),
  energy            int check (energy between 1 and 5),
  stress            int check (stress between 1 and 5),
  adherence         int check (adherence between 1 and 5),
  notes             text not null default '',
  photos            text[] not null default '{}',   -- percorsi nello storage "progress"
  trainer_feedback  text not null default '',
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index on public.check_ins (client_id, date desc);

-- ════════════════════════════════════════════════════════════════════════════
--  FUNZIONI DI SUPPORTO
-- ════════════════════════════════════════════════════════════════════════════
create function public.is_trainer_of(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients where id = cid and trainer_id = auth.uid());
$$;

create function public.my_trainer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select trainer_id from clients where id = auth.uid();
$$;

create function public.program_owner(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select trainer_id from programs where id = pid;
$$;

-- Il cliente vede un programma solo se è suo e non è una bozza.
create function public.can_view_program(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from programs p where p.id = pid
      and (p.trainer_id = auth.uid() or (p.client_id = auth.uid() and p.status <> 'draft'))
  );
$$;

create function public.workout_program(wid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select program_id from workouts where id = wid;
$$;

create function public.log_client(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from workout_logs where id = lid;
$$;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

-- ── REGISTRAZIONE ────────────────────────────────────────────────────────────
-- Verifica un codice invito PRIMA della registrazione (chiamabile senza login).
create function public.check_invite(invite_code text)
returns table (full_name text, business_name text, trainer_name text)
language sql stable security definer set search_path = public as $$
  select i.full_name, t.business_name, p.full_name
  from client_invites i
  join trainers t on t.id = i.trainer_id
  join profiles p on p.id = t.id
  where i.code = upper(trim(invite_code)) and i.accepted_by is null;
$$;

-- Alla registrazione crea profilo + trainer o cliente in base ai metadati.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role   text  := coalesce(meta->>'role', 'trainer');
  v_name   text  := coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1));
  v_code   text  := upper(trim(coalesce(meta->>'invite_code', '')));
  v_inv    client_invites%rowtype;
  v_active int;
  v_max    int;
begin
  if v_role = 'client' then
    select * into v_inv from client_invites where code = v_code and accepted_by is null for update;
    if not found then
      raise exception 'Codice invito non valido o già usato' using errcode = 'P0001';
    end if;
    select count(*) into v_active from clients where trainer_id = v_inv.trainer_id and status <> 'archived';
    select max_clients into v_max from trainers where id = v_inv.trainer_id;
    if v_active >= v_max then
      raise exception 'Il tuo coach ha raggiunto il numero massimo di clienti del suo piano' using errcode = 'P0001';
    end if;
    insert into profiles (id, role, full_name) values (new.id, 'client', v_name);
    insert into clients (id, trainer_id) values (new.id, v_inv.trainer_id);
    insert into client_notes (client_id, trainer_id) values (new.id, v_inv.trainer_id);
    update client_invites set accepted_by = new.id, accepted_at = now() where code = v_code;
  else
    insert into profiles (id, role, full_name) values (new.id, 'trainer', v_name);
    insert into trainers (id, business_name) values (new.id, coalesce(meta->>'business_name', ''));
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cancellazione account dall'app (obbligatoria per App Store / Play Store).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Copia un programma (es. da modello a cliente, o duplica).
create function public.duplicate_program(src uuid, target_client uuid default null, new_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src  programs%rowtype;
  v_new  uuid;
  w      record;
  v_wnew uuid;
begin
  select * into v_src from programs where id = src and trainer_id = auth.uid();
  if not found then raise exception 'Programma non trovato'; end if;
  if target_client is not null and not is_trainer_of(target_client) then
    raise exception 'Cliente non valido';
  end if;
  insert into programs (trainer_id, client_id, name, description, weeks, status)
  values (auth.uid(), target_client, coalesce(new_name, v_src.name), v_src.description, v_src.weeks, 'draft')
  returning id into v_new;
  for w in select * from workouts where program_id = src order by position loop
    insert into workouts (program_id, name, position, notes)
    values (v_new, w.name, w.position, w.notes) returning id into v_wnew;
    insert into workout_exercises (workout_id, exercise_id, position, superset, sets, reps, load,
                                   rest_seconds, tempo, notes, week_overrides)
    select v_wnew, exercise_id, position, superset, sets, reps, load, rest_seconds, tempo, notes, week_overrides
    from workout_exercises where workout_id = w.id;
  end loop;
  return v_new;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles          enable row level security;
alter table public.trainers          enable row level security;
alter table public.clients           enable row level security;
alter table public.client_notes      enable row level security;
alter table public.client_invites    enable row level security;
alter table public.exercises         enable row level security;
alter table public.programs          enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_logs      enable row level security;
alter table public.set_logs          enable row level security;
alter table public.messages          enable row level security;
alter table public.check_ins         enable row level security;

-- profiles: me stesso, i miei clienti (se trainer), il mio trainer (se cliente)
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid() or is_trainer_of(id) or id = my_trainer_id()
);
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- trainers: il trainer vede/modifica sé stesso; il cliente vede il suo trainer.
-- (piano e limiti si cambiano solo lato server: vedi colonne revocate sotto)
create policy "trainers_select" on public.trainers for select using (id = auth.uid() or id = my_trainer_id());
create policy "trainers_update_self" on public.trainers for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.trainers from authenticated;
grant update (business_name) on public.trainers to authenticated;

-- clients
create policy "clients_select" on public.clients for select using (id = auth.uid() or trainer_id = auth.uid());
create policy "clients_update_trainer" on public.clients for update
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "clients_update_self" on public.clients for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "clients_delete_trainer" on public.clients for delete using (trainer_id = auth.uid());
revoke update on public.clients from authenticated;
grant update (status, goal, birth_date, height_cm, sex) on public.clients to authenticated;

-- note private
create policy "notes_trainer" on public.client_notes for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid() and is_trainer_of(client_id));

-- inviti
create policy "invites_trainer" on public.client_invites for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- esercizi: libreria comune + quelli del trainer (visibili anche ai suoi clienti)
create policy "exercises_select" on public.exercises for select using (
  trainer_id is null or trainer_id = auth.uid() or trainer_id = my_trainer_id()
);
create policy "exercises_write" on public.exercises for insert with check (trainer_id = auth.uid());
create policy "exercises_update" on public.exercises for update
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "exercises_delete" on public.exercises for delete using (trainer_id = auth.uid());

-- programmi
create policy "programs_trainer" on public.programs for all
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid() and (client_id is null or is_trainer_of(client_id)));
create policy "programs_client_select" on public.programs for select
  using (client_id = auth.uid() and status <> 'draft');

create policy "workouts_select" on public.workouts for select using (can_view_program(program_id));
create policy "workouts_trainer" on public.workouts for all
  using (program_owner(program_id) = auth.uid()) with check (program_owner(program_id) = auth.uid());

create policy "wex_select" on public.workout_exercises for select using (can_view_program(workout_program(workout_id)));
create policy "wex_trainer" on public.workout_exercises for all
  using (program_owner(workout_program(workout_id)) = auth.uid())
  with check (program_owner(workout_program(workout_id)) = auth.uid());

-- diario: il cliente scrive il suo, il trainer legge e commenta
create policy "logs_client" on public.workout_logs for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "logs_trainer_select" on public.workout_logs for select using (is_trainer_of(client_id));
create policy "logs_trainer_update" on public.workout_logs for update
  using (is_trainer_of(client_id)) with check (is_trainer_of(client_id));

create policy "sets_client" on public.set_logs for all
  using (log_client(log_id) = auth.uid()) with check (log_client(log_id) = auth.uid());
create policy "sets_trainer_select" on public.set_logs for select using (is_trainer_of(log_client(log_id)));

-- chat
create policy "messages_select" on public.messages for select
  using (client_id = auth.uid() or is_trainer_of(client_id));
create policy "messages_insert" on public.messages for insert
  with check (sender_id = auth.uid() and (client_id = auth.uid() or is_trainer_of(client_id)));
create policy "messages_mark_read" on public.messages for update
  using ((client_id = auth.uid() or is_trainer_of(client_id)) and sender_id <> auth.uid())
  with check ((client_id = auth.uid() or is_trainer_of(client_id)) and sender_id <> auth.uid());
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- check-in
create policy "checkins_client" on public.check_ins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "checkins_trainer_select" on public.check_ins for select using (is_trainer_of(client_id));
create policy "checkins_trainer_update" on public.check_ins for update
  using (is_trainer_of(client_id)) with check (is_trainer_of(client_id));

-- Funzioni interne: non esposte all'esterno
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.duplicate_program(uuid, uuid, text) from public, anon;

-- ════════════════════════════════════════════════════════════════════════════
--  FOTO PROGRESSI (storage privato: cartella = id cliente)
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "progress_read" on storage.objects for select using (
  bucket_id = 'progress' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_trainer_of(((storage.foldername(name))[1])::uuid)
  )
);
create policy "progress_upload" on storage.objects for insert with check (
  bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "progress_delete" on storage.objects for delete using (
  bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ════════════════════════════════════════════════════════════════════════════
--  TEMPO REALE (chat e aggiornamenti) + NOTIFICHE PUSH
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.programs;

-- Invia una notifica push tramite il servizio Expo. Non blocca mai l'operazione.
create function public.send_push(target uuid, title text, body text, data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  select push_token into v_token from profiles where id = target;
  if v_token is null or v_token = '' then return; end if;
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('to', v_token, 'title', title, 'body', left(body, 180),
                                  'sound', 'default', 'data', data)
  );
exception when others then
  raise warning 'push non inviata: %', sqlerrm;
end $$;
revoke execute on function public.send_push(uuid, text, text, jsonb) from public, anon, authenticated;

create function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_target uuid; v_name text;
begin
  select full_name into v_name from profiles where id = new.sender_id;
  if new.sender_id = new.client_id then
    select trainer_id into v_target from clients where id = new.client_id;
  else
    v_target := new.client_id;
  end if;
  perform send_push(v_target, coalesce(v_name, 'Nuovo messaggio'), new.body,
                    jsonb_build_object('type', 'message', 'clientId', new.client_id));
  return new;
end $$;
create trigger messages_push after insert on public.messages
  for each row execute function public.notify_message();

create function public.notify_program() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null and new.sent_at is not null
     and new.sent_at is distinct from old.sent_at then
    perform send_push(new.client_id, 'Nuova scheda dal tuo coach 💪', new.name,
                      jsonb_build_object('type', 'program', 'programId', new.id));
  end if;
  return new;
end $$;
create trigger programs_push after update on public.programs
  for each row execute function public.notify_program();

create function public.notify_trainer_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_trainer uuid; v_name text;
begin
  select c.trainer_id, p.full_name into v_trainer, v_name
  from clients c join profiles p on p.id = c.id where c.id = new.client_id;
  if tg_table_name = 'check_ins' then
    perform send_push(v_trainer, 'Nuovo check-in', coalesce(v_name, 'Un cliente') || ' ha inviato un check-in',
                      jsonb_build_object('type', 'checkin', 'clientId', new.client_id));
  elsif new.completed_at is not null and old.completed_at is null then
    perform send_push(v_trainer, 'Allenamento completato ✅',
                      coalesce(v_name, 'Un cliente') || ' ha completato ' || new.workout_name,
                      jsonb_build_object('type', 'workout', 'clientId', new.client_id, 'logId', new.id));
  end if;
  return new;
end $$;
create trigger checkins_push after insert on public.check_ins
  for each row execute function public.notify_trainer_activity();
create trigger logs_push after update on public.workout_logs
  for each row execute function public.notify_trainer_activity();

-- Il ruolo (trainer/cliente) non si può cambiare dall'app.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, push_token) on public.profiles to authenticated;

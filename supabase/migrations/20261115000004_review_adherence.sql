-- Questionario di fine scheda: aderenza al programma e fattori di stress esterni.
alter table public.program_reviews
  add column adherence      int check (adherence between 1 and 5),            -- aderenza percepita dal cliente
  add column adherence_pct  int check (adherence_pct between 0 and 100),      -- aderenza reale (allenamenti fatti / previsti)
  add column stressors      text[] not null default '{}';                     -- es. {Lavoro, Sonno}

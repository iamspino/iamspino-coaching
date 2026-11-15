import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Chip, ErrorText, Field, Loading, Row, Scale, Screen, SectionTitle, Spacer, Txt, notify } from '@/components/ui';
import { must, useData } from '@/lib/hooks';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Program } from '@/lib/types';

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90, 120];

/** Questionario di fine programmazione: aiuta il coach a preparare la scheda successiva. */
export default function ProgramReviewForm() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const { data: program } = useData(async () =>
    must(await supabase.from('programs').select('id, name').eq('id', programId).single()) as Pick<Program, 'id' | 'name'>, [programId]);
  const [s, setS] = useState<Record<string, number | null>>({ overall: null, difficulty: null, enjoyment: null, results: null, duration_ok: null });
  const [t, setT] = useState({ liked: '', disliked: '', pain: '', next_goal: '', notes: '' });
  const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!program) return <Loading />;
  const scale = (k: string) => ({ value: s[k] ?? null, onChange: (v: number) => setS({ ...s, [k]: v }) });
  const text = (k: keyof typeof t) => ({ value: t[k], onChangeText: (v: string) => setT({ ...t, [k]: v }), multiline: true });

  async function submit() {
    setErr('');
    if (!s.overall || !s.difficulty) return setErr('Indica almeno la soddisfazione generale e la difficoltà.');
    setBusy(true);
    const { error } = await supabase.from('program_reviews').upsert({
      program_id: programId, program_name: program!.name, ...s,
      liked: t.liked.trim(), disliked: t.disliked.trim(), pain: t.pain.trim(), next_goal: t.next_goal.trim(), notes: t.notes.trim(),
      days_per_week: days, session_minutes: minutes,
    }, { onConflict: 'program_id' });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    notify('Grazie! ✓', 'Il tuo coach userà le tue risposte per preparare la prossima scheda.');
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Questionario finale' }} />
      <Txt v="title">Com'è andata {program.name}?</Txt>
      <Txt v="muted" style={{ marginTop: 6 }}>Due minuti: le tue risposte servono al coach per costruire la prossima scheda su misura.</Txt>

      <SectionTitle>La scheda appena conclusa</SectionTitle>
      <Scale label="Soddisfazione generale" {...scale('overall')} low="Per niente" high="Moltissimo" />
      <Scale label="Difficoltà" {...scale('difficulty')} low="Troppo facile" high="Troppo dura" />
      <Scale label="Quanto ti è piaciuta" {...scale('enjoyment')} low="Poco" high="Tanto" />
      <Scale label="Risultati che hai notato" {...scale('results')} low="Nessuno" high="Ottimi" />
      <Scale label="Durata delle sedute" {...scale('duration_ok')} low="Troppo corte" high="Troppo lunghe" />
      <Field label="Cosa ti è piaciuto di più" placeholder="Esercizi, giornate, metodi…" {...text('liked')} />
      <Field label="Cosa cambieresti o toglieresti" placeholder="Esercizi che non ti convincono o che non riesci a fare bene" {...text('disliked')} />
      <Field label="Dolori o fastidi" placeholder="Es. fastidio alla spalla destra sulle spinte sopra la testa" {...text('pain')} />

      <SectionTitle>La prossima scheda</SectionTitle>
      <Field label="Obiettivo per il prossimo periodo" placeholder="Es. più forza sulla panca, perdere 3 kg, migliorare i glutei" {...text('next_goal')} />
      <Txt v="label" style={{ marginBottom: 8 }}>Quanti giorni a settimana puoi allenarti</Txt>
      <Row wrap gap={8} style={{ marginBottom: 16 }}>
        {DAYS.map(d => <Chip key={d} label={String(d)} on={days === d} onPress={() => setDays(days === d ? null : d)} />)}
      </Row>
      <Txt v="label" style={{ marginBottom: 8 }}>Quanto tempo hai per seduta (minuti)</Txt>
      <Row wrap gap={8} style={{ marginBottom: 16 }}>
        {MINUTES.map(m => <Chip key={m} label={String(m)} on={minutes === m} onPress={() => setMinutes(minutes === m ? null : m)} />)}
      </Row>
      <Field label="Altro da dire al coach" placeholder="Cambi di palestra, attrezzi disponibili, impegni, viaggi…" {...text('notes')} />

      <Spacer />
      <ErrorText>{err}</ErrorText>
      <Button title="Invia al coach" icon="paper-plane" onPress={submit} loading={busy} />
    </Screen>
  );
}

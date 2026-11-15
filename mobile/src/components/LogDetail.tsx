import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@/config';
import { fmtDate, fmtDuration } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { SetLog, WorkoutLog } from '@/lib/types';
import { FeelingRow } from './Progress';
import { Button, Card, Field, Loading, Row, Screen, SectionTitle, Txt, notify } from './ui';

/** Dettaglio di un allenamento svolto. Il trainer può lasciare un commento. */
export function LogDetail({ id, asTrainer }: { id: string; asTrainer: boolean }) {
  const { data: log, setData } = useData(async () =>
    must(await supabase.from('workout_logs').select('*, set_logs(*)').eq('id', id).single()) as WorkoutLog, [id]);
  const [comment, setComment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!log) return <Loading />;
  const groups = new Map<string, SetLog[]>();
  for (const s of [...(log.set_logs ?? [])].sort((a, b) => a.set_number - b.set_number)) {
    const k = s.workout_exercise_id ?? s.exercise_name;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  const volume = (log.set_logs ?? []).reduce((t, s) => t + (s.done ? Number(s.load || 0) * Number(s.reps || 0) : 0), 0);

  async function saveComment() {
    setSaving(true);
    const { error } = await supabase.from('workout_logs').update({ trainer_comment: comment ?? '' }).eq('id', id);
    setSaving(false);
    if (error) notify('Errore', error.message);
    else { setData({ ...log!, trainer_comment: comment ?? '' }); setComment(null); }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: log.workout_name || 'Allenamento' }} />
      <Txt v="title">{log.workout_name || 'Allenamento'}</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>
        {fmtDate(log.started_at, true)} · Sett. {log.week}{log.completed_at ? ` · ${fmtDuration(log.started_at, log.completed_at)}` : ' · non completato'}
        {volume ? ` · ${Math.round(volume)} kg volume` : ''}
      </Txt>
      <View style={{ marginTop: 10 }}><FeelingRow value={log.feeling} /></View>
      {log.notes ? <Card style={{ marginTop: 12 }}><Txt v="label">Note del cliente</Txt><Txt style={{ marginTop: 4 }}>{log.notes}</Txt></Card> : null}

      <SectionTitle>Serie eseguite</SectionTitle>
      {[...groups.values()].map(sets => (
        <Card key={sets[0]!.id}>
          <Txt style={{ fontWeight: '700', marginBottom: 8 }}>{sets[0]!.exercise_name}</Txt>
          {sets.map(s => (
            <Row key={s.id} style={{ paddingVertical: 4 }}>
              <Txt v="muted" style={{ width: 60 }}>Serie {s.set_number}</Txt>
              <Txt style={{ flex: 1, fontWeight: '600' }} color={s.done ? colors.text : colors.muted}>
                {s.reps ?? '—'} rip × {s.load ?? 0} kg
              </Txt>
              {!s.done ? <Txt v="small">saltata</Txt> : null}
            </Row>
          ))}
        </Card>
      ))}
      {groups.size === 0 ? <Txt v="muted">Nessuna serie registrata.</Txt> : null}

      <SectionTitle>Commento del coach</SectionTitle>
      {asTrainer && comment !== null ? (
        <>
          <Field value={comment} onChangeText={setComment} multiline placeholder="Ottimo lavoro! La prossima volta prova +2,5 kg sulla panca." />
          <Button title="Salva commento" onPress={saveComment} loading={saving} />
        </>
      ) : log.trainer_comment ? (
        <Card highlight onPress={asTrainer ? () => setComment(log.trainer_comment) : undefined}>
          <Txt>{log.trainer_comment}</Txt>
        </Card>
      ) : asTrainer ? (
        <Button title="Scrivi un commento" variant="ghost" icon="chatbox-outline" onPress={() => setComment('')} />
      ) : <Txt v="muted">Il coach non ha ancora commentato.</Txt>}
    </Screen>
  );
}

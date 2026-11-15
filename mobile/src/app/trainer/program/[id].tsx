import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Badge, Button, Card, Chip, Icon, IconButton, Loading, Row, Screen, SectionTitle, Spacer, Txt, confirm, notify,
} from '@/components/ui';
import { colors } from '@/config';
import { fmtRest, timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { PROGRAM_STATUS } from '@/lib/program';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Client, Program, Workout, WorkoutExercise } from '@/lib/types';

export default function ProgramEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, reload } = useData(async () => {
    const p = must(await supabase.from('programs')
      .select('*, workouts(*, workout_exercises(*, exercises(*)))').eq('id', id).single()) as Program;
    p.workouts = (p.workouts ?? []).sort((a, b) => a.position - b.position);
    p.workouts.forEach(w => { w.workout_exercises = (w.workout_exercises ?? []).sort((a, b) => a.position - b.position); });
    let clientName = '';
    if (p.client_id) {
      const { data: c } = await supabase.from('profiles').select('full_name').eq('id', p.client_id).single();
      clientName = c?.full_name ?? '';
    }
    return { program: p, clientName };
  }, [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Client[] | null>(null);

  if (!data) return <Loading />;
  const { program: p, clientName } = data;
  const isTemplate = !p.client_id;
  const nEx = (p.workouts ?? []).reduce((n, w) => n + (w.workout_exercises?.length ?? 0), 0);

  const patch = async (fields: Partial<Program>) => {
    setData({ ...data, program: { ...p, ...fields } });
    const { error } = await supabase.from('programs').update(fields).eq('id', id);
    if (error) notify('Errore', errorMessage(error));
  };

  async function addWorkout() {
    const n = p.workouts?.length ?? 0;
    const name = `Giorno ${String.fromCharCode(65 + (n % 26))}`;
    const { error } = await supabase.from('workouts').insert({ program_id: id, name, position: n });
    if (error) notify('Errore', errorMessage(error)); else reload();
  }

  async function send() {
    if (nEx === 0) return notify('Scheda vuota', 'Aggiungi almeno un esercizio prima di inviarla.');
    const first = p.status !== 'active';
    if (!(await confirm(first ? 'Invia al cliente' : 'Invia aggiornamento',
      first ? `${clientName} riceverà una notifica e vedrà subito la scheda.` : `${clientName} riceverà una notifica che la scheda è stata aggiornata.`,
      'Invia', false))) return;
    setBusy('send');
    await patch({ status: 'active', sent_at: new Date().toISOString(), start_date: p.start_date ?? new Date().toISOString().slice(0, 10) });
    setBusy(null);
    notify('Scheda inviata ✓');
  }

  async function saveAsTemplate() {
    setBusy('tpl');
    const { error } = await supabase.rpc('duplicate_program', { src: id, target_client: null, new_name: p.name });
    setBusy(null);
    if (error) notify('Errore', errorMessage(error)); else notify('Modello salvato ✓', 'Lo trovi in Schede → Modelli.');
  }

  async function openAssign() {
    const { data: cl } = await supabase.from('clients').select('*, profiles(full_name)').eq('status', 'active');
    setAssigning((cl as Client[]) ?? []);
  }
  async function assignTo(c: Client) {
    setBusy('assign');
    const { data: newId, error } = await supabase.rpc('duplicate_program', { src: id, target_client: c.id });
    setBusy(null);
    if (error) return notify('Errore', errorMessage(error));
    setAssigning(null);
    router.replace(`/trainer/program/${newId}`);
  }

  async function remove() {
    if (!(await confirm('Elimina scheda', 'La scheda e il suo contenuto verranno eliminati. Lo storico allenamenti del cliente resta salvato.', 'Elimina'))) return;
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) notify('Errore', errorMessage(error)); else router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isTemplate ? 'Modello' : clientName }} />
      <Row style={{ marginBottom: 12 }} gap={8}>
        <Badge label={isTemplate ? 'Modello' : PROGRAM_STATUS[p.status].label} color={isTemplate ? colors.blue : PROGRAM_STATUS[p.status].color} />
        {p.sent_at && !isTemplate ? <Txt v="small">inviata {timeAgo(p.sent_at)}</Txt> : null}
      </Row>
      <InlineField value={p.name} onSave={name => patch({ name: name || 'Scheda' })} style={st.title} placeholder="Nome scheda" />
      <InlineField value={p.description} onSave={description => patch({ description })} style={st.desc} placeholder="Descrizione o indicazioni generali (facoltativo)" multiline />

      <Row style={{ marginTop: 10 }}>
        <Txt v="label" style={{ flex: 1 }}>Durata</Txt>
        <IconButton name="remove-circle-outline" color={colors.muted2} onPress={() => p.weeks > 1 && patch({ weeks: p.weeks - 1 })} label="Meno settimane" />
        <Txt style={{ fontWeight: '700', minWidth: 90, textAlign: 'center' }}>{p.weeks} settimane</Txt>
        <IconButton name="add-circle-outline" color={colors.accent} onPress={() => p.weeks < 52 && patch({ weeks: p.weeks + 1 })} label="Più settimane" />
      </Row>

      {(p.workouts ?? []).map((w, i) => (
        <WorkoutCard key={w.id} w={w} index={i} total={p.workouts!.length} workouts={p.workouts!} onChange={reload} />
      ))}
      <Button title="Aggiungi giorno di allenamento" icon="add" variant="ghost" onPress={addWorkout} style={{ marginTop: 14 }} />

      <SectionTitle>Azioni</SectionTitle>
      {!isTemplate ? (
        <Button title={p.status === 'active' ? 'Invia aggiornamento al cliente' : 'Invia al cliente'} icon="paper-plane"
          variant="success" onPress={send} loading={busy === 'send'} />
      ) : (
        <Button title="Assegna a un cliente" icon="person-add-outline" onPress={openAssign} loading={busy === 'assign'} />
      )}
      {assigning ? (
        <Card style={{ marginTop: 10 }}>
          <Txt v="label" style={{ marginBottom: 8 }}>Scegli il cliente</Txt>
          <Row wrap gap={8}>{assigning.map(c => <Chip key={c.id} label={c.profiles?.full_name ?? ''} onPress={() => assignTo(c)} />)}</Row>
          {assigning.length === 0 ? <Txt v="muted">Nessun cliente attivo.</Txt> : null}
        </Card>
      ) : null}
      <Spacer h={10} />
      {!isTemplate ? <Button title="Salva come modello" icon="copy-outline" variant="ghost" onPress={saveAsTemplate} loading={busy === 'tpl'} /> : null}
      {!isTemplate && p.status === 'active' ? (
        <Button title="Archivia (il cliente non la vedrà più tra le attive)" variant="ghost" small style={{ marginTop: 10 }}
          onPress={() => patch({ status: 'archived' })} />
      ) : null}
      {p.status === 'archived' ? <Button title="Riattiva" variant="ghost" small style={{ marginTop: 10 }} onPress={() => patch({ status: 'active' })} /> : null}
      <Button title="Elimina scheda" variant="danger" small onPress={remove} style={{ marginTop: 24 }} />
    </Screen>
  );
}

function WorkoutCard({ w, index, total, workouts, onChange }: { w: Workout; index: number; total: number; workouts: Workout[]; onChange: () => void }) {
  const exs = w.workout_exercises ?? [];

  async function swap<T extends { id: string; position: number }>(table: 'workouts' | 'workout_exercises', list: T[], i: number, j: number) {
    const a = list[i], b = list[j];
    if (!a || !b) return;
    await Promise.all([
      supabase.from(table).update({ position: j }).eq('id', a.id),
      supabase.from(table).update({ position: i }).eq('id', b.id),
    ]);
    // normalizza le altre posizioni
    await Promise.all(list.map((x, k) => (k !== i && k !== j && x.position !== k) ? supabase.from(table).update({ position: k }).eq('id', x.id) : null));
    onChange();
  }

  async function rename(name: string) {
    await supabase.from('workouts').update({ name: name || `Giorno ${index + 1}` }).eq('id', w.id);
  }
  async function saveNotes(notes: string) {
    await supabase.from('workouts').update({ notes }).eq('id', w.id);
  }
  async function remove() {
    if (!(await confirm('Elimina giorno', `Eliminare "${w.name}" e i suoi esercizi?`, 'Elimina'))) return;
    await supabase.from('workouts').delete().eq('id', w.id);
    onChange();
  }
  async function duplicate() {
    const { data: nw } = await supabase.from('workouts')
      .insert({ program_id: w.program_id, name: `${w.name} (copia)`, position: total, notes: w.notes }).select().single();
    if (nw && exs.length) {
      await supabase.from('workout_exercises').insert(exs.map(e => ({
        workout_id: nw.id, exercise_id: e.exercise_id, position: e.position, superset: e.superset, sets: e.sets, reps: e.reps,
        load: e.load, rest_seconds: e.rest_seconds, tempo: e.tempo, notes: e.notes, week_overrides: e.week_overrides,
      })));
    }
    onChange();
  }

  return (
    <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
      <View style={st.wHead}>
        <Txt style={st.wNum}>{index + 1}</Txt>
        <InlineField value={w.name} onSave={rename} style={st.wName} placeholder="Nome allenamento" />
        <IconButton name="chevron-up" size={18} color={index ? colors.muted2 : colors.surface3} onPress={() => swap('workouts', workouts, index, index - 1)} label="Sposta su" />
        <IconButton name="chevron-down" size={18} color={index < total - 1 ? colors.muted2 : colors.surface3} onPress={() => swap('workouts', workouts, index, index + 1)} label="Sposta giù" />
        <IconButton name="copy-outline" size={18} color={colors.muted2} onPress={duplicate} label="Duplica" />
        <IconButton name="trash-outline" size={18} color={colors.red} onPress={remove} label="Elimina" />
      </View>
      <View style={{ paddingHorizontal: 12 }}>
        <InlineField value={w.notes} onSave={saveNotes} style={st.wNotes} placeholder="Note (riscaldamento, indicazioni…)" multiline />
      </View>
      {exs.map((e, i) => (
        <ExerciseRow key={e.id} e={e} index={i}
          onUp={i > 0 ? () => swap('workout_exercises', exs, i, i - 1) : undefined}
          onDown={i < exs.length - 1 ? () => swap('workout_exercises', exs, i, i + 1) : undefined} />
      ))}
      <Pressable style={st.addEx} onPress={() => router.push({ pathname: '/trainer/pick-exercise', params: { workoutId: w.id, position: String(exs.length) } })}>
        <Icon name="add-circle" size={20} color={colors.accent} />
        <Txt color={colors.accent} style={{ fontWeight: '700' }}>Aggiungi esercizio</Txt>
      </Pressable>
    </Card>
  );
}

function ExerciseRow({ e, index, onUp, onDown }: { e: WorkoutExercise; index: number; onUp?: () => void; onDown?: () => void }) {
  const overrides = Object.keys(e.week_overrides ?? {}).length;
  return (
    <Pressable onPress={() => router.push(`/trainer/wex/${e.id}`)} style={({ pressed }) => [st.exRow, pressed && { backgroundColor: colors.surface2 }]}>
      {e.superset ? <View style={st.ss}><Txt style={{ color: colors.accentText, fontWeight: '800', fontSize: 12 }}>{e.superset}</Txt></View>
        : <Txt v="muted" style={{ width: 22, textAlign: 'center' }}>{index + 1}</Txt>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ fontWeight: '600' }} numberOfLines={1}>{e.exercises?.name ?? 'Esercizio'}</Txt>
        <Txt v="small" numberOfLines={1}>
          {e.sets} × {e.reps}{e.load ? ` · ${e.load}` : ''} · rec {fmtRest(e.rest_seconds)}{e.tempo ? ` · ${e.tempo}` : ''}
          {overrides ? ` · ${overrides} var.` : ''}
        </Txt>
      </View>
      <IconButton name="chevron-up" size={16} color={onUp ? colors.muted : colors.surface3} onPress={() => onUp?.()} label="Su" />
      <IconButton name="chevron-down" size={16} color={onDown ? colors.muted : colors.surface3} onPress={() => onDown?.()} label="Giù" />
    </Pressable>
  );
}

/** Campo di testo che si salva quando si esce dal campo. */
function InlineField({ value, onSave, style, placeholder, multiline }: {
  value: string; onSave: (v: string) => void; style: object; placeholder: string; multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  return (
    <TextInput value={v} onChangeText={setV} onBlur={() => v.trim() !== value && onSave(v.trim())}
      placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} style={[{ color: colors.text }, style]} />
  );
}

const st = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', paddingVertical: 4 },
  desc: { fontSize: 14, color: colors.muted2, paddingVertical: 4 },
  wHead: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface2, paddingBottom: 8 },
  wNum: { color: colors.accent, fontWeight: '900', fontSize: 18, marginRight: 6 },
  wName: { flex: 1, fontSize: 17, fontWeight: '700', paddingVertical: 4 },
  wNotes: { fontSize: 13, color: colors.muted2, paddingVertical: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  ss: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addEx: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'center' },
});


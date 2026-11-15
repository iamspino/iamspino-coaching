import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Chip, Field, IconButton, Loading, Row, Screen, SectionTitle, Spacer, Txt, confirm, notify } from '@/components/ui';
import { colors } from '@/config';
import { fmtRest } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { errorMessage, supabase } from '@/lib/supabase';
import type { WeekOverride, WorkoutExercise } from '@/lib/types';

const REST_PRESETS = [30, 45, 60, 90, 120, 180, 240];
const SUPERSETS = ['', 'A', 'B', 'C', 'D', 'E'];

export default function EditWorkoutExercise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData(async () =>
    must(await supabase.from('workout_exercises').select('*, exercises(*), workouts(program_id, programs(weeks))').eq('id', id).single()) as
      WorkoutExercise & { workouts: { program_id: string; programs: { weeks: number } } }, [id]);

  const [f, setF] = useState<WorkoutExercise | null>(null);
  const [overrides, setOverrides] = useState<Record<string, WeekOverride>>({});
  const [showWeeks, setShowWeeks] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !f) {
      setF(data); setOverrides(data.week_overrides ?? {});
      setShowWeeks(Object.keys(data.week_overrides ?? {}).length > 0);
    }
  }, [data, f]);

  if (!data || !f) return <Loading />;
  const weeks = data.workouts?.programs?.weeks ?? 4;
  const set = (k: keyof WorkoutExercise, v: unknown) => setF({ ...f, [k]: v });

  function setOverride(week: number, k: keyof WeekOverride, v: string) {
    const cur = { ...(overrides[String(week)] ?? {}) };
    if (v.trim() === '') delete cur[k];
    else if (k === 'sets') cur.sets = Math.max(1, Math.min(20, parseInt(v, 10) || 1));
    else cur[k] = v;
    const next = { ...overrides };
    if (Object.keys(cur).length) next[String(week)] = cur; else delete next[String(week)];
    setOverrides(next);
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('workout_exercises').update({
      sets: f!.sets, reps: f!.reps.trim() || '10', load: f!.load.trim(), rest_seconds: f!.rest_seconds,
      tempo: f!.tempo.trim(), notes: f!.notes.trim(), superset: f!.superset, week_overrides: overrides,
    }).eq('id', id);
    setBusy(false);
    if (error) notify('Errore', errorMessage(error)); else router.back();
  }

  async function remove() {
    if (!(await confirm('Rimuovi esercizio', 'Rimuovere l\'esercizio da questo allenamento?', 'Rimuovi'))) return;
    await supabase.from('workout_exercises').delete().eq('id', id);
    router.back();
  }

  const ex = data.exercises;
  return (
    <Screen>
      <Stack.Screen options={{ title: ex?.name ?? 'Esercizio' }} />
      <Txt v="title">{ex?.name}</Txt>
      <Row gap={8} style={{ marginTop: 4 }}>
        <Txt v="muted">{[ex?.muscle_group, ex?.equipment].filter(Boolean).join(' · ')}</Txt>
        {ex?.video_url ? <Button title="Video" icon="play" small variant="ghost" onPress={() => Linking.openURL(ex.video_url!)} /> : null}
      </Row>

      <SectionTitle>Prescrizione</SectionTitle>
      <Row style={{ marginBottom: 14 }}>
        <Txt v="label" style={{ flex: 1 }}>Serie</Txt>
        <IconButton name="remove-circle-outline" color={colors.muted2} size={28} onPress={() => set('sets', Math.max(1, f.sets - 1))} label="Meno serie" />
        <Txt style={{ fontSize: 22, fontWeight: '800', minWidth: 44, textAlign: 'center' }}>{f.sets}</Txt>
        <IconButton name="add-circle-outline" color={colors.accent} size={28} onPress={() => set('sets', Math.min(20, f.sets + 1))} label="Più serie" />
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label="Ripetizioni" value={f.reps} onChangeText={v => set('reps', v)} placeholder="8-10" hint="es. 10 · 8-10 · 12/10/8 · 30s" /></View>
        <View style={{ flex: 1 }}><Field label="Carico" value={f.load} onChangeText={v => set('load', v)} placeholder="60kg" hint="es. 60kg · RPE 8 · 70%" /></View>
      </Row>

      <Txt v="label" style={{ marginBottom: 8 }}>Recupero · {fmtRest(f.rest_seconds)}</Txt>
      <Row wrap gap={8} style={{ marginBottom: 16 }}>
        {REST_PRESETS.map(r => <Chip key={r} label={fmtRest(r)} on={f.rest_seconds === r} onPress={() => set('rest_seconds', r)} />)}
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label="Tempo (TUT)" value={f.tempo} onChangeText={v => set('tempo', v)} placeholder="3-1-1-0" /></View>
        <View style={{ flex: 1 }}>
          <Txt v="label" style={{ marginBottom: 8 }}>Superserie</Txt>
          <Row wrap gap={6}>{SUPERSETS.map(sx => <Chip key={sx || 'none'} label={sx || '—'} on={f.superset === sx} onPress={() => set('superset', sx)} />)}</Row>
        </View>
      </Row>
      <Txt v="small" style={{ marginBottom: 14 }}>Esercizi con la stessa lettera vengono eseguiti in superserie.</Txt>
      <Field label="Note per il cliente" value={f.notes} onChangeText={v => set('notes', v)} multiline placeholder="es. Eccentrica controllata, scapole addotte" />

      <SectionTitle right={!showWeeks ? <Button title="Aggiungi" small variant="ghost" icon="add" onPress={() => setShowWeeks(true)} /> : null}>
        Progressione settimanale
      </SectionTitle>
      {showWeeks ? (
        <Card style={{ padding: 0 }}>
          <View style={[st.row, st.head]}>
            <Txt v="label" style={st.wk}>Sett.</Txt>
            <Txt v="label" style={st.c1}>Serie</Txt>
            <Txt v="label" style={st.c2}>Rip.</Txt>
            <Txt v="label" style={st.c2}>Carico</Txt>
          </View>
          {Array.from({ length: weeks }, (_, i) => i + 1).map(w => {
            const o = overrides[String(w)] ?? {};
            return (
              <View key={w} style={st.row}>
                <Txt style={[st.wk, { fontWeight: '700' }]} color={Object.keys(o).length ? colors.accent : colors.muted2}>{w}</Txt>
                <TextInput style={[st.cell, st.c1]} keyboardType="number-pad" placeholder={String(f.sets)} placeholderTextColor={colors.muted}
                  value={o.sets != null ? String(o.sets) : ''} onChangeText={v => setOverride(w, 'sets', v)} />
                <TextInput style={[st.cell, st.c2]} placeholder={f.reps} placeholderTextColor={colors.muted}
                  value={o.reps ?? ''} onChangeText={v => setOverride(w, 'reps', v)} />
                <TextInput style={[st.cell, st.c2]} placeholder={f.load || '—'} placeholderTextColor={colors.muted}
                  value={o.load ?? ''} onChangeText={v => setOverride(w, 'load', v)} />
              </View>
            );
          })}
        </Card>
      ) : null}
      {showWeeks ? <Txt v="small">Lascia vuoto per usare i valori base. Il cliente vedrà automaticamente i valori della settimana in corso.</Txt> : null}

      <Spacer h={24} />
      <Button title="Salva" onPress={save} loading={busy} />
      <Button title="Rimuovi dall'allenamento" variant="danger" small onPress={remove} style={{ marginTop: 18 }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  head: { borderTopWidth: 0, paddingVertical: 10 },
  wk: { width: 42, textAlign: 'center' },
  c1: { width: 60 },
  c2: { flex: 1 },
  cell: { backgroundColor: colors.surface2, borderRadius: 8, color: colors.text, paddingHorizontal: 8, height: 38, fontSize: 15, textAlign: 'center' },
});

import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { RestTimer } from '@/components/RestTimer';
import { Button, Card, Field, Icon, Loading, Row, Screen, SectionTitle, Spacer, Txt, confirm, notify } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { fmtRest, num, prescription } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import type { SetLog, Workout, WorkoutExercise, WorkoutLog } from '@/lib/types';

interface SetRow { reps: string; load: string; done: boolean }
interface Prev { reps: number | null; load: number | null }

const FEELINGS = ['😫', '😕', '😐', '🙂', '💪'];

export default function WorkoutSession() {
  const { id, programId, week: weekParam } = useLocalSearchParams<{ id: string; programId: string; week: string }>();
  const week = Number(weekParam) || 1;
  const { profile } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [prev, setPrev] = useState<Record<string, Prev[]>>({});
  const [logId, setLogId] = useState<string | null>(null);
  const [timer, setTimer] = useState<{ end: number; label: string } | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [err, setErr] = useState('');
  const creating = useRef<Promise<string> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: w, error } = await supabase.from('workouts').select('*, workout_exercises(*, exercises(*))').eq('id', id).single();
      if (error || !w) { setErr(errorMessage(error)); return; }
      const wk = w as Workout;
      wk.workout_exercises?.sort((a, b) => a.position - b.position);
      const exs = wk.workout_exercises ?? [];
      const ids = exs.map(e => e.id);

      // sessione da riprendere (iniziata nelle ultime 12 ore e non finita)
      const { data: open } = await supabase.from('workout_logs').select('*, set_logs(*)')
        .eq('client_id', profile!.id).eq('workout_id', id).is('completed_at', null)
        .gte('started_at', new Date(Date.now() - 12 * 3600000).toISOString())
        .order('started_at', { ascending: false }).limit(1);
      const resume = (open as WorkoutLog[] | null)?.[0];

      // ultima volta (per suggerire i carichi)
      const { data: hist } = ids.length ? await supabase.from('set_logs')
        .select('workout_exercise_id, set_number, reps, load, log_id, workout_logs!inner(started_at, completed_at, client_id)')
        .in('workout_exercise_id', ids).eq('workout_logs.client_id', profile!.id).not('workout_logs.completed_at', 'is', null)
        .limit(1000) : { data: [] };
      const lastLog = new Map<string, { at: string; sets: Prev[] }>();
      for (const s of (hist ?? []) as unknown as (SetLog & { workout_logs: { started_at: string } })[]) {
        const k = s.workout_exercise_id!;
        const at = s.workout_logs.started_at;
        const cur = lastLog.get(k);
        if (!cur || at > cur.at) lastLog.set(k, { at, sets: [] });
        if (lastLog.get(k)!.at === at) lastLog.get(k)!.sets[s.set_number - 1] = { reps: s.reps, load: s.load };
      }
      const p: Record<string, Prev[]> = {};
      lastLog.forEach((v, k) => { p[k] = v.sets; });

      const r: Record<string, SetRow[]> = {};
      for (const e of exs) {
        const pr = prescription(e, week);
        r[e.id] = Array.from({ length: pr.sets }, (_, i) => {
          const saved = resume?.set_logs?.find(s => s.workout_exercise_id === e.id && s.set_number === i + 1);
          if (saved) return { reps: saved.reps != null ? String(saved.reps) : '', load: saved.load != null ? String(saved.load) : '', done: saved.done };
          return { reps: '', load: '', done: false };
        });
        // serie extra aggiunte in una sessione ripresa
        const extra = (resume?.set_logs ?? []).filter(s => s.workout_exercise_id === e.id && s.set_number > pr.sets);
        extra.sort((a, b) => a.set_number - b.set_number).forEach(s =>
          r[e.id]!.push({ reps: String(s.reps ?? ''), load: String(s.load ?? ''), done: s.done }));
      }
      setPrev(p); setRows(r); setWorkout(wk);
      if (resume) { setLogId(resume.id); setNotes(resume.notes); }
    })();
  }, [id, week, profile]);

  const ensureLog = useCallback(async () => {
    if (logId) return logId;
    if (!creating.current) {
      creating.current = (async () => {
        const { data, error } = await supabase.from('workout_logs')
          .insert({ program_id: programId || null, workout_id: id, workout_name: workout?.name ?? '', week }).select('id').single();
        if (error) throw error;
        setLogId(data.id);
        return data.id as string;
      })();
    }
    return creating.current;
  }, [logId, programId, id, workout, week]);

  if (err) return <Screen><Txt color={colors.red}>{err}</Txt></Screen>;
  if (!workout) return <Loading />;
  const exs = workout.workout_exercises ?? [];

  function placeholderReps(e: WorkoutExercise, i: number) {
    const pv = prev[e.id]?.[i];
    if (pv?.reps) return String(pv.reps);
    const m = prescription(e, week).reps.match(/\d+/g);
    return m ? m[Math.min(i, m.length - 1)]! : '';
  }
  function placeholderLoad(e: WorkoutExercise, i: number) {
    const pv = prev[e.id]?.[i] ?? prev[e.id]?.at(-1);
    if (pv?.load) return String(pv.load);
    const m = prescription(e, week).load.match(/\d+([.,]\d+)?/);
    return m && /kg/i.test(prescription(e, week).load) ? m[0] : '';
  }

  function update(eid: string, i: number, patch: Partial<SetRow>) {
    setRows(r => ({ ...r, [eid]: r[eid]!.map((s, k) => k === i ? { ...s, ...patch } : s) }));
  }

  async function toggleSet(e: WorkoutExercise, i: number) {
    const s = rows[e.id]![i]!;
    const done = !s.done;
    const reps = s.reps || placeholderReps(e, i);
    const load = s.load || placeholderLoad(e, i);
    update(e.id, i, { done, reps, load });
    if (done) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // in superserie si recupera dopo l'ultimo esercizio del gruppo
      const group = e.superset ? exs.filter(x => x.superset === e.superset) : [e];
      const isLastOfGroup = group[group.length - 1]!.id === e.id;
      if (e.rest_seconds > 0 && isLastOfGroup) setTimer({ end: Date.now() + e.rest_seconds * 1000, label: e.exercises?.name ?? '' });
    }
    try {
      const lid = await ensureLog();
      const { error } = await supabase.from('set_logs').upsert({
        log_id: lid, workout_exercise_id: e.id, exercise_id: e.exercise_id, exercise_name: e.exercises?.name ?? '',
        set_number: i + 1, reps: num(reps), load: num(load), done,
      }, { onConflict: 'log_id,workout_exercise_id,set_number' });
      if (error) throw error;
    } catch (x) {
      update(e.id, i, { done: !done });
      notify('Non salvato', errorMessage(x));
    }
  }

  function addSet(e: WorkoutExercise) {
    setRows(r => ({ ...r, [e.id]: [...r[e.id]!, { reps: '', load: '', done: false }] }));
  }

  const total = Object.values(rows).reduce((n, r) => n + r.length, 0);
  const completed = Object.values(rows).reduce((n, r) => n + r.filter(s => s.done).length, 0);

  async function finish() {
    if (completed === 0) return notify('Nessuna serie completata', 'Spunta le serie che hai fatto prima di terminare.');
    if (completed < total && !(await confirm('Terminare?', `Hai completato ${completed} serie su ${total}. Vuoi terminare comunque?`, 'Termina', false))) return;
    setFinishing(true);
    try {
      const lid = await ensureLog();
      const { error } = await supabase.from('workout_logs')
        .update({ completed_at: new Date().toISOString(), feeling, notes: notes.trim() }).eq('id', lid);
      if (error) throw error;
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/client/log/${lid}`);
    } catch (x) {
      setFinishing(false);
      notify('Errore', errorMessage(x));
    }
  }

  async function discard() {
    if (!(await confirm('Annulla allenamento', 'Le serie registrate in questa sessione verranno cancellate.', 'Annulla allenamento'))) return;
    if (logId) await supabase.from('workout_logs').delete().eq('id', logId);
    router.back();
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: workout.name }} />
      <Screen>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <Txt v="muted">Settimana {week}</Txt>
          <Txt v="muted" color={completed === total && total ? colors.green : colors.muted2}>{completed}/{total} serie</Txt>
        </Row>
        <View style={st.progress}><View style={[st.progressFill, { width: `${total ? (completed / total) * 100 : 0}%` }]} /></View>
        {workout.notes ? <Card style={{ marginTop: 12 }}><Txt v="label">Indicazioni</Txt><Txt style={{ marginTop: 4 }}>{workout.notes}</Txt></Card> : null}

        {exs.map((e, idx) => {
          const pr = prescription(e, week);
          const pv = prev[e.id];
          const sets = rows[e.id] ?? [];
          const allDone = sets.length > 0 && sets.every(s => s.done);
          return (
            <Card key={e.id} style={[{ marginTop: 14 }, allDone && { borderColor: colors.green + '88' }]}>
              <Row gap={10} style={{ alignItems: 'flex-start' }}>
                <View style={[st.num, e.superset ? { backgroundColor: colors.accent } : null]}>
                  <Txt style={{ fontWeight: '900' }} color={e.superset ? colors.accentText : colors.accent}>{e.superset || idx + 1}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800', fontSize: 17 }}>{e.exercises?.name}</Txt>
                  <Txt color={colors.accent} style={{ fontWeight: '700', marginTop: 2 }}>
                    {pr.sets} × {pr.reps}{pr.load ? ` · ${pr.load}` : ''} · rec {fmtRest(e.rest_seconds)}
                  </Txt>
                  {e.tempo ? <Txt v="small">Tempo {e.tempo}</Txt> : null}
                  {e.superset ? <Txt v="small">Superserie {e.superset}</Txt> : null}
                </View>
                {e.exercises?.video_url ? (
                  <Pressable onPress={() => Linking.openURL(e.exercises!.video_url!)} hitSlop={8} accessibilityLabel="Video">
                    <Icon name="play-circle" size={32} color={colors.text} />
                  </Pressable>
                ) : null}
              </Row>
              {e.notes ? <Txt v="muted" style={st.note}>{e.notes}</Txt> : null}

              <View style={st.headRow}>
                <Txt v="label" style={st.cSet}>Serie</Txt>
                <Txt v="label" style={st.cPrev}>Ultima volta</Txt>
                <Txt v="label" style={st.cIn}>Kg</Txt>
                <Txt v="label" style={st.cIn}>Rip.</Txt>
                <View style={st.cChk} />
              </View>
              {sets.map((s, i) => (
                <View key={i} style={[st.setRow, s.done && { backgroundColor: colors.green + '1a' }]}>
                  <Txt style={[st.cSet, { fontWeight: '700' }]}>{i + 1}</Txt>
                  <Txt v="small" style={st.cPrev}>{pv?.[i] ? `${pv[i]!.load ?? 0}kg × ${pv[i]!.reps ?? '-'}` : '—'}</Txt>
                  <TextInput style={[st.input, st.cIn]} keyboardType="decimal-pad" value={s.load} placeholder={placeholderLoad(e, i)}
                    placeholderTextColor={colors.muted} onChangeText={v => update(e.id, i, { load: v })} selectTextOnFocus />
                  <TextInput style={[st.input, st.cIn]} keyboardType="number-pad" value={s.reps} placeholder={placeholderReps(e, i)}
                    placeholderTextColor={colors.muted} onChangeText={v => update(e.id, i, { reps: v })} selectTextOnFocus />
                  <Pressable onPress={() => toggleSet(e, i)} style={[st.check, s.done && st.checkOn]} accessibilityLabel={`Serie ${i + 1} fatta`}>
                    <Icon name="checkmark" size={20} color={s.done ? '#000' : colors.muted} />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => addSet(e)} style={{ paddingTop: 10, alignSelf: 'center' }}>
                <Txt v="small" color={colors.muted2}>+ Aggiungi serie</Txt>
              </Pressable>
            </Card>
          );
        })}

        <SectionTitle>Fine allenamento</SectionTitle>
        <Txt v="label" style={{ marginBottom: 8 }}>Come ti sei sentito?</Txt>
        <Row gap={8} style={{ marginBottom: 14 }}>
          {FEELINGS.map((f, i) => (
            <Pressable key={f} onPress={() => setFeeling(i + 1)} style={[st.feel, feeling === i + 1 && { borderColor: colors.accent, backgroundColor: colors.accent + '22' }]}>
              <Txt style={{ fontSize: 26 }}>{f}</Txt>
            </Pressable>
          ))}
        </Row>
        <Field value={notes} onChangeText={setNotes} multiline placeholder="Note per il coach (dolori, sensazioni, carichi…)" />
        <Button title="Termina allenamento" icon="checkmark-done" variant="success" onPress={finish} loading={finishing} />
        <Button title="Annulla allenamento" variant="ghost" small onPress={discard} style={{ marginTop: 12 }} />
        <Spacer h={timer ? 90 : 10} />
      </Screen>
      <RestTimer endAt={timer?.end ?? null} label={timer?.label ?? ''}
        onAdd={s => setTimer(t => t ? { ...t, end: Math.max(t.end, Date.now()) + s * 1000 } : t)}
        onClose={() => setTimer(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  progress: { height: 6, backgroundColor: colors.surface3, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green },
  num: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 8, borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 4, paddingHorizontal: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 10 },
  cSet: { width: 40, textAlign: 'center' },
  cPrev: { flex: 1 },
  cIn: { width: 64, textAlign: 'center' },
  cChk: { width: 44 },
  input: { backgroundColor: colors.surface2, borderRadius: 8, color: colors.text, height: 40, fontSize: 16, fontWeight: '700' },
  check: { width: 44, height: 40, borderRadius: 10, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.green },
  feel: { flex: 1, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});

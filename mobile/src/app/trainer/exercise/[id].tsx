import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Button, Chip, ErrorText, Field, Loading, Row, Screen, Spacer, Txt, confirm } from '@/components/ui';
import { MUSCLE_GROUPS } from '@/config';
import { useAuth } from '@/lib/auth';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Exercise } from '@/lib/types';

export default function ExerciseEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isNew = id === 'new';
  const [ex, setEx] = useState<Partial<Exercise> | null>(isNew ? { name: '', muscle_group: '', equipment: '', video_url: '', instructions: '' } : null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNew) supabase.from('exercises').select('*').eq('id', id).single().then(({ data }) => setEx(data as Exercise));
  }, [id, isNew]);

  if (!ex) return <Loading />;
  const readOnly = !isNew && ex.trainer_id !== profile?.id;
  const set = (k: keyof Exercise, v: string) => setEx({ ...ex, [k]: v });

  async function save() {
    setErr('');
    if (!ex!.name?.trim()) return setErr('Inserisci il nome dell\'esercizio.');
    const url = ex!.video_url?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) return setErr('Il link del video deve iniziare con https://');
    setBusy(true);
    const fields = { name: ex!.name.trim(), muscle_group: ex!.muscle_group ?? '', equipment: ex!.equipment?.trim() ?? '', video_url: url, instructions: ex!.instructions?.trim() ?? '' };
    const res = isNew
      ? await supabase.from('exercises').insert({ ...fields, trainer_id: profile!.id })
      : await supabase.from('exercises').update(fields).eq('id', id);
    setBusy(false);
    if (res.error) return setErr(errorMessage(res.error));
    router.back();
  }

  async function remove() {
    if (!(await confirm('Elimina esercizio', 'Eliminarlo dalla tua libreria?', 'Elimina'))) return;
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) setErr(errorMessage(error)); else router.back();
  }

  if (readOnly) {
    return (
      <Screen>
        <Stack.Screen options={{ title: ex.name }} />
        <Txt v="title">{ex.name}</Txt>
        <Txt v="muted" style={{ marginTop: 4 }}>{[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ')}</Txt>
        {ex.instructions ? <Txt style={{ marginTop: 14 }}>{ex.instructions}</Txt> : null}
        <Spacer h={18} />
        {ex.video_url ? <Button title="Guarda il video" icon="play" onPress={() => Linking.openURL(ex.video_url!)} /> : null}
        <Txt v="small" style={{ marginTop: 14 }}>Esercizio della libreria comune. Per personalizzarlo (es. con un tuo video) creane una copia.</Txt>
        <Button title="Crea una mia copia" variant="ghost" icon="copy-outline" style={{ marginTop: 12 }} onPress={async () => {
          const { data } = await supabase.from('exercises').insert({
            name: ex.name, muscle_group: ex.muscle_group, equipment: ex.equipment, instructions: ex.instructions, video_url: ex.video_url, trainer_id: profile!.id,
          }).select('id').single();
          if (data) router.replace(`/trainer/exercise/${data.id}`);
        }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Nuovo esercizio' : 'Modifica esercizio' }} />
      <Field label="Nome" value={ex.name} onChangeText={v => set('name', v)} placeholder="es. Panca piana con fermo" autoFocus={isNew} />
      <Txt v="label" style={{ marginBottom: 8 }}>Gruppo muscolare</Txt>
      <Row wrap gap={8} style={{ marginBottom: 16 }}>
        {MUSCLE_GROUPS.map(g => <Chip key={g} label={g} on={ex.muscle_group === g} onPress={() => set('muscle_group', g)} />)}
      </Row>
      <Field label="Attrezzatura" value={ex.equipment} onChangeText={v => set('equipment', v)} placeholder="Bilanciere, manubri, cavi…" />
      <Field label="Link video" value={ex.video_url ?? ''} onChangeText={v => set('video_url', v)} autoCapitalize="none" keyboardType="url"
        placeholder="https://youtube.com/…" hint="YouTube, Instagram, Vimeo o qualsiasi link. Il cliente lo apre dalla scheda." />
      <Field label="Istruzioni" value={ex.instructions} onChangeText={v => set('instructions', v)} multiline placeholder="Esecuzione, errori comuni…" />
      <ErrorText>{err}</ErrorText>
      <Button title="Salva" onPress={save} loading={busy} />
      {!isNew ? <Button title="Elimina" variant="danger" small onPress={remove} style={{ marginTop: 18 }} /> : null}
    </Screen>
  );
}

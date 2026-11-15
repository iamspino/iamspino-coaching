import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Button, ErrorText, Field, Icon, Row, Scale, Screen, SectionTitle, Spacer, Txt, notify } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { num } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';

const MEASURES = [
  ['weight', 'Peso (kg)'], ['body_fat', 'Massa grassa (%)'], ['waist', 'Vita (cm)'], ['hips', 'Fianchi (cm)'],
  ['chest', 'Petto (cm)'], ['arm', 'Braccio (cm)'], ['thigh', 'Coscia (cm)'],
] as const;
type MeasureKey = typeof MEASURES[number][0];

export default function NewCheckIn() {
  const { profile } = useAuth();
  const [m, setM] = useState<Partial<Record<MeasureKey, string>>>({});
  const [scales, setScales] = useState<Record<string, number | null>>({ sleep: null, energy: null, stress: null, adherence: null });
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [moreMeasures, setMoreMeasures] = useState(false);

  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Permesso negato', 'Abilita l\'accesso nelle impostazioni del telefono.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: !camera, selectionLimit: 4 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setPhotos(p => [...p, ...res.assets].slice(0, 6));
  }

  async function submit() {
    setErr('');
    const values: Record<string, number | null> = {};
    for (const [k] of MEASURES) {
      const raw = m[k]?.trim();
      if (!raw) continue;
      const v = num(raw);
      if (v === null) return setErr('Controlla le misure: usa solo numeri.');
      values[k] = v;
    }
    if (!Object.keys(values).length && !notes.trim() && !photos.length && !Object.values(scales).some(Boolean)) {
      return setErr('Compila almeno un campo.');
    }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const ph of photos) {
        const ext = (ph.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
        const path = `${profile!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const body = await (await fetch(ph.uri)).arrayBuffer();
        const { error } = await supabase.storage.from('progress').upload(path, body, { contentType: ph.mimeType ?? 'image/jpeg' });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await supabase.from('check_ins').insert({ ...values, ...scales, notes: notes.trim(), photos: paths });
      if (error) throw error;
      notify('Check-in inviato ✓', 'Il tuo coach riceverà una notifica.');
      router.back();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = moreMeasures ? MEASURES : MEASURES.slice(0, 3);
  return (
    <Screen>
      <Txt v="muted">Compila quello che puoi: anche solo il peso va benissimo.</Txt>
      <SectionTitle>Misure</SectionTitle>
      <Row wrap gap={10}>
        {shown.map(([k, label]) => (
          <View key={k} style={{ width: '47%' }}>
            <Field label={label} value={m[k] ?? ''} onChangeText={v => setM({ ...m, [k]: v })} keyboardType="decimal-pad" />
          </View>
        ))}
      </Row>
      {!moreMeasures ? <Button title="Altre misure" variant="ghost" small icon="add" onPress={() => setMoreMeasures(true)} /> : null}

      <SectionTitle>Com'è andata la settimana</SectionTitle>
      <Scale label="Sonno" value={scales.sleep} onChange={v => setScales({ ...scales, sleep: v })} low="Pessimo" high="Ottimo" />
      <Scale label="Energia" value={scales.energy} onChange={v => setScales({ ...scales, energy: v })} low="Scarica" high="Al top" />
      <Scale label="Stress" value={scales.stress} onChange={v => setScales({ ...scales, stress: v })} low="Basso" high="Alto" />
      <Scale label="Aderenza al piano" value={scales.adherence} onChange={v => setScales({ ...scales, adherence: v })} low="Poca" high="Totale" />
      <Field label="Note" value={notes} onChangeText={setNotes} multiline placeholder="Come ti senti, difficoltà, domande per il coach…" />

      <SectionTitle>Foto progressi</SectionTitle>
      <Txt v="small" style={{ marginTop: -4, marginBottom: 10 }}>Visibili solo a te e al tuo coach.</Txt>
      <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
        {photos.map((p, i) => (
          <View key={p.uri}>
            <Image source={{ uri: p.uri }} style={{ width: 96, height: 128, borderRadius: 10 }} />
            <Pressable onPress={() => setPhotos(photos.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#000a', borderRadius: 12 }}>
              <Icon name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Button title="Scatta" icon="camera-outline" variant="ghost" small onPress={() => pick(true)} style={{ flex: 1 }} />
        <Button title="Galleria" icon="images-outline" variant="ghost" small onPress={() => pick(false)} style={{ flex: 1 }} />
      </Row>

      <Spacer h={24} />
      <ErrorText>{err}</ErrorText>
      <Button title="Invia al coach" icon="paper-plane" onPress={submit} loading={busy} />
      <Txt v="small" center color={colors.muted} style={{ marginTop: 10 }}>Il coach riceverà una notifica e potrà lasciarti un feedback.</Txt>
    </Screen>
  );
}

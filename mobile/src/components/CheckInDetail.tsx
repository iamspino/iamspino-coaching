import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { colors } from '@/config';
import { fmtDate } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { CheckIn } from '@/lib/types';
import { Button, Card, Field, Loading, Row, Screen, SectionTitle, Stat, Txt, notify } from './ui';

export function usePhotoUrls(paths: string[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!paths.length) { setUrls([]); return; }
    supabase.storage.from('progress').createSignedUrls(paths, 3600)
      .then(({ data }) => setUrls((data ?? []).map(d => d.signedUrl).filter(Boolean) as string[]));
  }, [paths.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

const SCALES: [keyof CheckIn, string][] = [['sleep', 'Sonno'], ['energy', 'Energia'], ['stress', 'Stress'], ['adherence', 'Aderenza']];
const MEASURES: [keyof CheckIn, string, string][] = [
  ['weight', 'Peso', 'kg'], ['body_fat', 'Grasso', '%'], ['waist', 'Vita', 'cm'], ['hips', 'Fianchi', 'cm'],
  ['chest', 'Petto', 'cm'], ['arm', 'Braccio', 'cm'], ['thigh', 'Coscia', 'cm'],
];

export function CheckInDetail({ id, asTrainer }: { id: string; asTrainer: boolean }) {
  const { data: c, setData } = useData(async () => must(await supabase.from('check_ins').select('*').eq('id', id).single()) as CheckIn, [id]);
  const urls = usePhotoUrls(c?.photos ?? []);
  const [big, setBig] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // il trainer che apre il check-in lo segna come visto
    if (asTrainer && c && !c.reviewed_at) {
      const now = new Date().toISOString();
      supabase.from('check_ins').update({ reviewed_at: now }).eq('id', id).then(() => setData({ ...c, reviewed_at: now }));
    }
  }, [asTrainer, c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Loading />;

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('check_ins').update({ trainer_feedback: feedback ?? '' }).eq('id', id);
    setSaving(false);
    if (error) notify('Errore', error.message);
    else { setData({ ...c!, trainer_feedback: feedback ?? '' }); setFeedback(null); }
  }

  const measures = MEASURES.filter(([k]) => c[k] != null);
  const scales = SCALES.filter(([k]) => c[k] != null);

  return (
    <Screen>
      <Stack.Screen options={{ title: `Check-in ${fmtDate(c.date)}` }} />
      {measures.length ? (
        <>
          <SectionTitle>Misure</SectionTitle>
          <Row wrap gap={8}>
            {measures.map(([k, l, u]) => <View key={k} style={{ width: '31.5%' }}><Stat value={`${c[k]}${u === '%' ? '%' : ''}`} label={`${l}${u !== '%' ? ' ' + u : ''}`} /></View>)}
          </Row>
        </>
      ) : null}
      {scales.length ? (
        <>
          <SectionTitle>Come sta andando</SectionTitle>
          <Row wrap gap={8}>
            {scales.map(([k, l]) => <View key={k} style={{ width: '48.5%' }}><Stat value={`${c[k]}/5`} label={l} color={colors.blue} /></View>)}
          </Row>
        </>
      ) : null}
      {c.notes ? (<><SectionTitle>Note</SectionTitle><Card><Txt>{c.notes}</Txt></Card></>) : null}
      {urls.length ? (
        <>
          <SectionTitle>Foto</SectionTitle>
          <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
            {urls.map(u => (
              <Pressable key={u} onPress={() => setBig(big === u ? null : u)}>
                <Image source={{ uri: u }} style={{ width: 140, height: 190, borderRadius: 12, backgroundColor: colors.surface2 }} />
              </Pressable>
            ))}
          </ScrollView>
          {big ? <Image source={{ uri: big }} resizeMode="contain" style={{ width: '100%', aspectRatio: 0.75, marginTop: 12, borderRadius: 12 }} /> : null}
        </>
      ) : null}

      <SectionTitle>Feedback del coach</SectionTitle>
      {asTrainer && feedback !== null ? (
        <>
          <Field value={feedback} onChangeText={setFeedback} multiline placeholder="Ottimi progressi sulla vita! Questa settimana…" />
          <Button title="Invia feedback" onPress={save} loading={saving} />
        </>
      ) : c.trainer_feedback ? (
        <Card highlight onPress={asTrainer ? () => setFeedback(c.trainer_feedback) : undefined}><Txt>{c.trainer_feedback}</Txt></Card>
      ) : asTrainer ? (
        <Button title="Scrivi un feedback" variant="ghost" icon="chatbox-outline" onPress={() => setFeedback('')} />
      ) : <Txt v="muted">{c.reviewed_at ? 'Il coach ha visto il tuo check-in.' : 'Il coach non l\'ha ancora visto.'}</Txt>}
    </Screen>
  );
}

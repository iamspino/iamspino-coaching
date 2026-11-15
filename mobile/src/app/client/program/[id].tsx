import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Badge, Button, Card, Chip, Icon, Loading, Row, Screen, SectionTitle, Txt } from '@/components/ui';
import { colors } from '@/config';
import { currentWeek, fmtRest, prescription } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { Program } from '@/lib/types';

export default function ClientProgram() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p } = useData(async () => {
    const p = must(await supabase.from('programs').select('*, workouts(*, workout_exercises(*, exercises(*)))').eq('id', id).single()) as Program;
    p.workouts?.sort((a, b) => a.position - b.position);
    p.workouts?.forEach(w => w.workout_exercises?.sort((a, b) => a.position - b.position));
    return p;
  }, [id]);
  const [week, setWeek] = useState<number | null>(null);
  if (!p) return <Loading />;
  const cur = currentWeek(p);
  const w = week ?? cur;

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <Txt v="title">{p.name}</Txt>
      {p.description ? <Txt v="muted" style={{ marginTop: 6 }}>{p.description}</Txt> : null}
      <SectionTitle>Settimana</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map(n => (
          <Chip key={n} label={n === cur ? `${n} · ora` : String(n)} on={n === w} onPress={() => setWeek(n)} />
        ))}
      </ScrollView>

      {(p.workouts ?? []).map(wo => (
        <View key={wo.id}>
          <SectionTitle>{wo.name}</SectionTitle>
          {wo.notes ? <Txt v="muted" style={{ marginBottom: 10 }}>{wo.notes}</Txt> : null}
          {(wo.workout_exercises ?? []).map((e, i) => {
            const pr = prescription(e, w);
            return (
              <Card key={e.id}>
                <Row gap={10} style={{ alignItems: 'flex-start' }}>
                  <Txt style={{ fontWeight: '900', width: 22 }} color={colors.accent}>{e.superset || i + 1}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '700' }}>{e.exercises?.name}</Txt>
                    <Txt style={{ marginTop: 4, fontSize: 17, fontWeight: '800' }} color={colors.accent}>
                      {pr.sets} × {pr.reps}{pr.load ? `  ·  ${pr.load}` : ''}
                    </Txt>
                    <Txt v="small" style={{ marginTop: 2 }}>Recupero {fmtRest(e.rest_seconds)}{e.tempo ? ` · tempo ${e.tempo}` : ''}</Txt>
                    {e.notes ? <Txt v="muted" style={{ marginTop: 6 }}>{e.notes}</Txt> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {pr.changed ? <Badge label={`Sett. ${w}`} /> : null}
                    {e.exercises?.video_url ? <Icon name="play-circle" size={28} color={colors.text} onPress={() => Linking.openURL(e.exercises!.video_url!)} /> : null}
                  </View>
                </Row>
              </Card>
            );
          })}
          <Button title={`Inizia ${wo.name}`} icon="play" small onPress={() => router.push({ pathname: '/client/workout/[id]', params: { id: wo.id, programId: p.id, week: String(w) } })} />
        </View>
      ))}
    </Screen>
  );
}

import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Empty, Icon, ListItem, Row, Screen, SectionTitle, Txt } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { currentWeek, fmtDate, timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { CheckIn, Program, WorkoutLog } from '@/lib/types';

export default function Today() {
  const { profile, trainer } = useAuth();
  const { data, loading, reload } = useData(async () => {
    const [p, l, c] = await Promise.all([
      supabase.from('programs').select('*, workouts(id, name, position, workout_exercises(id))')
        .eq('client_id', profile!.id).eq('status', 'active').order('sent_at', { ascending: false }),
      supabase.from('workout_logs').select('*').eq('client_id', profile!.id).order('started_at', { ascending: false }).limit(60),
      supabase.from('check_ins').select('*').eq('client_id', profile!.id).order('date', { ascending: false }).limit(1),
    ]);
    const programs = must(p) as Program[];
    programs.forEach(x => x.workouts?.sort((a, b) => a.position - b.position));
    return { programs, logs: must(l) as WorkoutLog[], lastCheckIn: (must(c) as CheckIn[])[0] ?? null };
  }, [profile?.id]);

  const first = profile?.full_name.split(' ')[0] ?? '';
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const logs = data?.logs ?? [];
  const resume = logs.find(l => !l.completed_at && Date.now() - new Date(l.started_at).getTime() < 12 * 3600000);
  const weekAgo = Date.now() - 7 * 86400000;
  const doneThisWeek = logs.filter(l => l.completed_at && new Date(l.completed_at).getTime() > weekAgo).length;
  const checkInDue = data && (!data.lastCheckIn || new Date(data.lastCheckIn.date).getTime() < weekAgo);
  const comments = logs.filter(l => l.trainer_comment && new Date(l.started_at).getTime() > Date.now() - 14 * 86400000).slice(0, 2);

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Txt v="muted">{hello},</Txt>
      <Txt v="display">{first} 💪</Txt>
      <Row gap={8} style={{ marginTop: 8, marginBottom: 6 }}>
        <Icon name="flame" size={18} color={colors.accent} />
        <Txt v="muted">{doneThisWeek} allenament{doneThisWeek === 1 ? 'o' : 'i'} negli ultimi 7 giorni</Txt>
      </Row>

      {resume ? (
        <Card highlight onPress={() => router.push({ pathname: '/client/workout/[id]', params: { id: resume.workout_id!, programId: resume.program_id!, week: String(resume.week) } })}>
          <Row><Icon name="play-circle" size={30} color={colors.accent} />
            <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>Riprendi {resume.workout_name}</Txt><Txt v="small">Iniziato {timeAgo(resume.started_at)}</Txt></View>
            <Icon name="chevron-forward" size={18} color={colors.muted} /></Row>
        </Card>
      ) : null}

      {data && data.programs.length === 0 ? (
        <Empty icon="barbell-outline" title="Nessuna scheda attiva"
          text={`${trainer?.business_name || 'Il tuo coach'} sta preparando il tuo programma. Riceverai una notifica appena è pronto.`}
          action={<Button title="Scrivi al coach" variant="ghost" icon="chatbubble-outline" onPress={() => router.push('/client/chat')} />} />
      ) : null}

      {data?.programs.map(p => {
        const week = currentWeek(p);
        const workouts = p.workouts ?? [];
        // prossimo allenamento consigliato: quello dopo l'ultimo completato di questa scheda
        const lastDone = logs.find(l => l.program_id === p.id && l.completed_at);
        const lastIdx = workouts.findIndex(w => w.id === lastDone?.workout_id);
        const next = workouts[(lastIdx + 1) % Math.max(1, workouts.length)];
        return (
          <View key={p.id}>
            <SectionTitle right={<Txt v="small" color={colors.accent} style={{ fontWeight: '700' }}>Settimana {week}/{p.weeks}</Txt>}>{p.name}</SectionTitle>
            {next ? (
              <Card highlight>
                <Txt v="label">Prossimo allenamento</Txt>
                <Txt v="title" style={{ marginTop: 4 }}>{next.name}</Txt>
                <Txt v="muted" style={{ marginBottom: 12 }}>{next.workout_exercises?.length ?? 0} esercizi</Txt>
                <Button title="Inizia allenamento" icon="play" onPress={() => router.push({ pathname: '/client/workout/[id]', params: { id: next.id, programId: p.id, week: String(week) } })} />
              </Card>
            ) : null}
            {workouts.filter(w => w.id !== next?.id).map(w => {
              const last = logs.find(l => l.workout_id === w.id && l.completed_at);
              return (
                <ListItem key={w.id}
                  onPress={() => router.push({ pathname: '/client/workout/[id]', params: { id: w.id, programId: p.id, week: String(week) } })}
                  left={<Icon name="barbell-outline" size={22} color={colors.muted2} />}
                  title={w.name}
                  subtitle={`${w.workout_exercises?.length ?? 0} esercizi · ${last ? `fatto ${timeAgo(last.completed_at)}` : 'mai fatto'}`} />
              );
            })}
            <Button title="Vedi scheda completa" variant="ghost" small onPress={() => router.push(`/client/program/${p.id}`)} />
          </View>
        );
      })}

      {checkInDue ? (
        <>
          <SectionTitle>Check-in</SectionTitle>
          <Card onPress={() => router.push('/client/checkin/new')}>
            <Row><Icon name="clipboard-outline" size={26} color={colors.blue} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '700' }}>È ora del check-in settimanale</Txt>
                <Txt v="small">{data?.lastCheckIn ? `Ultimo: ${fmtDate(data.lastCheckIn.date)}` : 'Peso, misure e foto: aiuta il coach a seguirti meglio'}</Txt>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} /></Row>
          </Card>
        </>
      ) : null}

      {comments.length ? (
        <>
          <SectionTitle>Dal tuo coach</SectionTitle>
          {comments.map(l => (
            <ListItem key={l.id} onPress={() => router.push(`/client/log/${l.id}`)}
              left={<Icon name="chatbox-ellipses" size={22} color={colors.accent} />}
              title={`${l.workout_name} · ${fmtDate(l.started_at)}`} subtitle={l.trainer_comment} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

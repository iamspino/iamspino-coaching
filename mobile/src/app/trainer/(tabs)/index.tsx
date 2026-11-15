import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Badge, Button, Card, Empty, Icon, ListItem, Row, Screen, SectionTitle, Stat, Txt } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { fmtDuration, timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { CheckIn, Client, Message, ProgramReview, WorkoutLog } from '@/lib/types';

export default function TrainerHome() {
  const { profile, trainer } = useAuth();
  const { data, loading, reload } = useData(async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [clients, logs, checkins, unread, reviews] = await Promise.all([
      supabase.from('clients').select('*, profiles(full_name)').neq('status', 'archived'),
      supabase.from('workout_logs').select('*').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(40),
      supabase.from('check_ins').select('*').is('reviewed_at', null).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').neq('sender_id', profile!.id).is('read_at', null),
      supabase.from('program_reviews').select('*').gte('created_at', since).order('created_at', { ascending: false }),
    ]);
    const cl = must(clients) as Client[];
    const lg = must(logs) as WorkoutLog[];
    const lastActivity = new Map<string, string>();
    for (const l of lg) if (!lastActivity.has(l.client_id)) lastActivity.set(l.client_id, l.completed_at!);
    return {
      clients: cl,
      names: new Map(cl.map(c => [c.id, c.profiles?.full_name ?? 'Cliente'])),
      logs: lg,
      week: lg.filter(l => l.completed_at! >= since).length,
      checkins: must(checkins) as CheckIn[],
      unread: must(unread) as Message[],
      reviews: must(reviews) as ProgramReview[],
      inactive: cl.filter(c => c.status === 'active' && (lastActivity.get(c.id) ?? '') < since),
      lastActivity,
    };
  }, [profile?.id]);

  const name = profile?.full_name.split(' ')[0] ?? '';
  const trialDays = trainer?.plan === 'trial' ? Math.ceil((new Date(trainer.trial_ends_at).getTime() - Date.now()) / 86400000) : null;
  const unreadByClient = new Map<string, number>();
  data?.unread.forEach(m => unreadByClient.set(m.client_id, (unreadByClient.get(m.client_id) ?? 0) + 1));

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Txt v="muted">Ciao {name} 👋</Txt>
      <Txt v="title" style={{ marginBottom: 14 }}>{trainer?.business_name || 'La tua dashboard'}</Txt>

      {trialDays !== null ? (
        <Card highlight onPress={() => router.push('/trainer/settings')}>
          <Row><Icon name="sparkles-outline" size={20} color={colors.accent} />
            <Txt style={{ flex: 1 }}>{trialDays > 0 ? `Prova gratuita: ancora ${trialDays} giorni` : 'Prova gratuita terminata'}</Txt>
            <Txt v="small" color={colors.accent}>Piani</Txt></Row>
        </Card>
      ) : null}

      <Row gap={8}>
        <Stat value={`${data?.clients.filter(c => c.status === 'active').length ?? '–'}`} label={`Clienti / ${trainer?.max_clients ?? ''}`} />
        <Stat value={data?.week ?? '–'} label="Allen. 7gg" color={colors.green} />
      </Row>
      <Row gap={8} style={{ marginTop: 8 }}>
        <Stat value={data?.checkins.length ?? '–'} label="Check-in nuovi" color={data?.checkins.length ? colors.red : colors.muted2} />
        <Stat value={data?.unread.length ?? '–'} label="Messaggi" color={data?.unread.length ? colors.blue : colors.muted2} />
      </Row>

      {data && data.clients.length === 0 ? (
        <Empty icon="person-add-outline" title="Inizia invitando un cliente"
          text="Il cliente scarica l'app, inserisce il codice e trovi subito il suo profilo qui."
          action={<Button title="Invita il primo cliente" icon="person-add-outline" onPress={() => router.push('/trainer/invite')} />} />
      ) : null}

      {data && (data.checkins.length > 0 || unreadByClient.size > 0 || data.reviews.length > 0) ? (
        <>
          <SectionTitle>Da fare</SectionTitle>
          {data.reviews.map(r => (
            <ListItem key={r.id} onPress={() => router.push(`/trainer/review/${r.id}`)}
              left={<Avatar name={data.names.get(r.client_id) ?? ''} size={38} />}
              title={data.names.get(r.client_id) ?? 'Cliente'}
              subtitle={`Ha finito ${r.program_name}: prepara la prossima scheda · ${timeAgo(r.created_at)}`}
              right={<Badge label="Questionario" color={colors.accent} />} />
          ))}
          {data.checkins.map(c => (
            <ListItem key={c.id} onPress={() => router.push(`/trainer/checkin/${c.id}`)}
              left={<Avatar name={data.names.get(c.client_id) ?? ''} size={38} />}
              title={data.names.get(c.client_id) ?? 'Cliente'}
              subtitle={`Nuovo check-in · ${timeAgo(c.created_at)}${c.weight ? ` · ${c.weight} kg` : ''}`}
              right={<Badge label="Check-in" color={colors.red} />} />
          ))}
          {[...unreadByClient.entries()].map(([cid, n]) => (
            <ListItem key={cid} onPress={() => router.push(`/trainer/chat/${cid}`)}
              left={<Avatar name={data.names.get(cid) ?? ''} size={38} />}
              title={data.names.get(cid) ?? 'Cliente'}
              subtitle={data.unread.filter(m => m.client_id === cid).at(-1)?.body}
              right={<Badge label={`${n} msg`} color={colors.blue} />} />
          ))}
        </>
      ) : null}

      {data && data.inactive.length > 0 ? (
        <>
          <SectionTitle>Da ricontattare</SectionTitle>
          <Txt v="small" style={{ marginTop: -4, marginBottom: 10 }}>Clienti attivi senza allenamenti negli ultimi 7 giorni</Txt>
          {data.inactive.slice(0, 5).map(c => (
            <ListItem key={c.id} onPress={() => router.push(`/trainer/chat/${c.id}`)}
              left={<Avatar name={c.profiles?.full_name ?? ''} size={38} />}
              title={c.profiles?.full_name ?? ''}
              subtitle={`Ultimo allenamento: ${timeAgo(data.lastActivity.get(c.id))}`}
              right={<Icon name="chatbubble-outline" size={18} color={colors.accent} />} chevron={false} />
          ))}
        </>
      ) : null}

      {data && data.logs.length > 0 ? (
        <>
          <SectionTitle>Attività recente</SectionTitle>
          {data.logs.slice(0, 10).map(l => (
            <ListItem key={l.id} onPress={() => router.push(`/trainer/log/${l.id}`)}
              left={<Icon name="checkmark-circle" size={26} color={colors.green} />}
              title={<Txt numberOfLines={1}><Txt style={{ fontWeight: '700' }}>{data.names.get(l.client_id) ?? 'Cliente'}</Txt> · {l.workout_name}</Txt>}
              subtitle={`${timeAgo(l.completed_at)} · ${fmtDuration(l.started_at, l.completed_at)}${l.feeling ? ` · sensazione ${l.feeling}/5` : ''}`}
              right={l.trainer_comment ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

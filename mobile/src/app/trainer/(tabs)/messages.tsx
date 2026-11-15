import { router } from 'expo-router';
import { useEffect } from 'react';
import { Avatar, Badge, Empty, ListItem, Screen, Txt } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { Client, Message } from '@/lib/types';

export default function Messages() {
  const { profile } = useAuth();
  const { data, reload, loading } = useData(async () => {
    const [c, m] = await Promise.all([
      supabase.from('clients').select('*, profiles(full_name)').neq('status', 'archived'),
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    const clients = must(c) as Client[];
    const msgs = must(m) as Message[];
    const last = new Map<string, Message>();
    const unread = new Map<string, number>();
    for (const x of msgs) {
      if (!last.has(x.client_id)) last.set(x.client_id, x);
      if (x.sender_id !== profile!.id && !x.read_at) unread.set(x.client_id, (unread.get(x.client_id) ?? 0) + 1);
    }
    return clients
      .map(cl => ({ cl, last: last.get(cl.id), unread: unread.get(cl.id) ?? 0 }))
      .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') ||
        (a.cl.profiles?.full_name ?? '').localeCompare(b.cl.profiles?.full_name ?? ''));
  }, [profile?.id]);

  // aggiorna la lista quando arrivano messaggi
  useEffect(() => {
    const ch = supabase.channel('trainer-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => reload()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      {(data ?? []).map(({ cl, last, unread }) => (
        <ListItem key={cl.id} onPress={() => router.push(`/trainer/chat/${cl.id}`)}
          left={<Avatar name={cl.profiles?.full_name ?? ''} />}
          title={cl.profiles?.full_name ?? 'Cliente'}
          subtitle={last ? <Txt v="small" numberOfLines={1} color={unread ? colors.text : undefined}>
            {last.sender_id === profile?.id ? 'Tu: ' : ''}{last.body}</Txt> : 'Nessun messaggio'}
          right={unread ? <Badge label={String(unread)} color={colors.blue} solid /> : last ? <Txt v="small">{timeAgo(last.created_at)}</Txt> : null}
          chevron={false} />
      ))}
      {data && data.length === 0 ? <Empty icon="chatbubbles-outline" title="Nessuna conversazione" text="Quando inviti dei clienti potrai scrivergli da qui." /> : null}
    </Screen>
  );
}

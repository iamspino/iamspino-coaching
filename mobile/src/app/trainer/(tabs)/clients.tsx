import { router } from 'expo-router';
import { useState } from 'react';
import { Avatar, Badge, Button, Empty, Field, IconButton, ListItem, Row, Screen, SectionTitle, Segmented, Txt, confirm } from '@/components/ui';
import { colors } from '@/config';
import { fmtDate } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { Client, Invite } from '@/lib/types';
import { shareInvite } from '@/lib/invite';

type Filter = 'active' | 'paused' | 'archived';
const STATUS: Record<Filter, { label: string; color: string }> = {
  active: { label: 'Attivo', color: colors.green },
  paused: { label: 'In pausa', color: colors.warn },
  archived: { label: 'Archiviato', color: colors.muted },
};

export default function Clients() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const { data, loading, reload } = useData(async () => {
    const [c, i] = await Promise.all([
      supabase.from('clients').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('client_invites').select('*').is('accepted_by', null).order('created_at', { ascending: false }),
    ]);
    return { clients: must(c) as Client[], invites: must(i) as Invite[] };
  });

  const list = (data?.clients ?? [])
    .filter(c => c.status === filter)
    .filter(c => !q || (c.profiles?.full_name ?? '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''));

  async function deleteInvite(code: string) {
    if (!(await confirm('Annulla invito', 'Il codice non funzionerà più.', 'Annulla invito'))) return;
    await supabase.from('client_invites').delete().eq('code', code);
    reload();
  }

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Button title="Invita cliente" icon="person-add-outline" onPress={() => router.push('/trainer/invite')} />
      {data && data.invites.length > 0 ? (
        <>
          <SectionTitle>Inviti in attesa</SectionTitle>
          {data.invites.map(i => (
            <ListItem key={i.code} chevron={false}
              title={i.full_name || 'Invito'}
              subtitle={`Codice ${i.code} · creato il ${fmtDate(i.created_at)}`}
              right={<Row gap={2}>
                <IconButton name="share-outline" color={colors.accent} label="Condividi" onPress={() => shareInvite(i.code, i.full_name)} />
                <IconButton name="close" color={colors.muted} label="Annulla" onPress={() => deleteInvite(i.code)} />
              </Row>} />
          ))}
        </>
      ) : null}

      <SectionTitle>I tuoi clienti</SectionTitle>
      <Segmented<Filter> value={filter} onChange={setFilter} options={[
        { value: 'active', label: `Attivi${data ? ` (${data.clients.filter(c => c.status === 'active').length})` : ''}` },
        { value: 'paused', label: 'In pausa' }, { value: 'archived', label: 'Archiviati' },
      ]} />
      <Field placeholder="Cerca cliente…" value={q} onChangeText={setQ} style={{ marginTop: 12 }} />
      {list.map(c => (
        <ListItem key={c.id} onPress={() => router.push(`/trainer/client/${c.id}`)}
          left={<Avatar name={c.profiles?.full_name ?? ''} />}
          title={c.profiles?.full_name ?? 'Cliente'}
          subtitle={c.goal || `Cliente dal ${fmtDate(c.created_at, true)}`}
          right={filter !== 'active' ? <Badge label={STATUS[c.status].label} color={STATUS[c.status].color} /> : null} />
      ))}
      {data && list.length === 0 ? (
        <Empty icon="people-outline" title={q ? 'Nessun risultato' : 'Nessun cliente qui'}
          text={filter === 'active' && !q ? 'Invita i tuoi clienti: riceveranno un codice per entrare nell\'app.' : undefined} />
      ) : null}
      <Txt v="small" center style={{ marginTop: 10 }}>{loading && !data ? 'Caricamento…' : ''}</Txt>
    </Screen>
  );
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ProgressView } from '@/components/Progress';
import {
  Avatar, Badge, Button, Card, Chip, Field, Icon, IconButton, ListItem, Loading, Row, Screen, SectionTitle,
  Segmented, Spacer, Txt, confirm, notify,
} from '@/components/ui';
import { colors } from '@/config';
import { fmtDate, timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { errorMessage, supabase } from '@/lib/supabase';
import { programAdherence } from '@/lib/adherence';
import { PROGRAM_STATUS } from '@/lib/program';
import { reviewSummary } from '@/components/ReviewDetail';
import type { Client, Program, ProgramReview } from '@/lib/types';

type Tab = 'programs' | 'progress' | 'profile';


export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('programs');
  const { data, setData } = useData(async () => {
    const [c, p, t, n, rv] = await Promise.all([
      supabase.from('clients').select('*, profiles(full_name)').eq('id', id).single(),
      supabase.from('programs').select('*, workouts(id)').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('programs').select('id, name, weeks').is('client_id', null).order('name'),
      supabase.from('client_notes').select('notes').eq('client_id', id).maybeSingle(),
      supabase.from('program_reviews').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]);
    const programs = must(p) as Program[];
    const active = programs.find(x => x.status === 'active');
    let adherence: number | null = null;
    if (active) {
      const { count } = await supabase.from('workout_logs').select('id', { count: 'exact', head: true })
        .eq('program_id', active.id).not('completed_at', 'is', null);
      adherence = programAdherence(active, active.workouts?.length ?? 0, count ?? 0);
    }
    return {
      adherence,
      client: must(c) as Client, programs,
      templates: must(t) as Pick<Program, 'id' | 'name' | 'weeks'>[], notes: (n.data?.notes as string) ?? '',
      reviews: must(rv) as ProgramReview[],
    };
  }, [id]);

  if (!data) return <Loading />;
  const { client } = data;
  const name = client.profiles?.full_name ?? 'Cliente';

  return (
    <Screen>
      <Stack.Screen options={{
        title: '',
        headerRight: () => <IconButton name="chatbubbles-outline" color={colors.accent} label="Chat" onPress={() => router.push(`/trainer/chat/${id}`)} />,
      }} />
      <Row gap={14} style={{ marginBottom: 16 }}>
        <Avatar name={name} size={58} />
        <View style={{ flex: 1 }}>
          <Txt v="title" numberOfLines={1}>{name}</Txt>
          <Txt v="muted" numberOfLines={1}>{client.goal || `Cliente dal ${fmtDate(client.created_at, true)}`}</Txt>
        </View>
        {data.adherence != null ? (
          <View style={{ alignItems: 'center' }}>
            <Txt style={{ fontSize: 22, fontWeight: '800' }}
              color={data.adherence >= 80 ? colors.green : data.adherence >= 50 ? colors.warn : colors.red}>{data.adherence}%</Txt>
            <Txt v="label" style={{ fontSize: 9 }}>Aderenza</Txt>
          </View>
        ) : null}
      </Row>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'programs', label: 'Schede' }, { value: 'progress', label: 'Progressi' }, { value: 'profile', label: 'Profilo' },
      ]} />
      <Spacer h={14} />
      {tab === 'programs' ? <ProgramsTab clientId={id} programs={data.programs} templates={data.templates} reviews={data.reviews} />
        : tab === 'progress' ? <ProgressView clientId={id} basePath="/trainer" />
        : <ProfileTab client={client} notes={data.notes} onSaved={(c, n) => setData({ ...data, client: c, notes: n })} />}
    </Screen>
  );
}

function ProgramsTab({ clientId, programs, templates, reviews }: {
  clientId: string; programs: Program[]; templates: Pick<Program, 'id' | 'name' | 'weeks'>[]; reviews: ProgramReview[];
}) {
  const lastReview = reviews[0];
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function createBlank() {
    setBusy(true);
    const { data, error } = await supabase.from('programs').insert({ client_id: clientId, name: 'Nuova scheda' }).select().single();
    setBusy(false);
    if (error) return notify('Errore', errorMessage(error));
    setPicking(false);
    router.push(`/trainer/program/${data.id}`);
  }
  async function fromTemplate(tid: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc('duplicate_program', { src: tid, target_client: clientId });
    setBusy(false);
    if (error) return notify('Errore', errorMessage(error));
    setPicking(false);
    router.push(`/trainer/program/${data}`);
  }

  return (
    <View>
      {picking ? (
        <Card highlight>
          <Txt v="h2" style={{ marginBottom: 10 }}>Nuova scheda</Txt>
          {lastReview ? (
            <Card onPress={() => router.push(`/trainer/review/${lastReview.id}`)} style={{ backgroundColor: colors.surface2 }}>
              <Txt v="label" color={colors.accent}>Ultimo questionario · {lastReview.program_name}</Txt>
              <Txt v="small" style={{ marginTop: 4 }}>{reviewSummary(lastReview)}</Txt>
              {lastReview.next_goal ? <Txt style={{ marginTop: 6 }} numberOfLines={2}>🎯 {lastReview.next_goal}</Txt> : null}
              {lastReview.pain ? <Txt style={{ marginTop: 4 }} color={colors.red} numberOfLines={2}>⚠️ {lastReview.pain}</Txt> : null}
            </Card>
          ) : null}
          <Button title="Bozza con AI" icon="sparkles" onPress={() => { setPicking(false); router.push(`/trainer/ai-draft/${clientId}`); }} />
          <Button title="Parti da zero" icon="add" variant="ghost" onPress={createBlank} loading={busy} style={{ marginTop: 10 }} />
          {templates.length ? <Txt v="label" style={{ marginTop: 16, marginBottom: 8 }}>Oppure da un modello</Txt> : null}
          <Row wrap gap={8}>{templates.map(t => <Chip key={t.id} label={`${t.name} · ${t.weeks} sett.`} onPress={() => fromTemplate(t.id)} />)}</Row>
          <Button title="Annulla" variant="ghost" small onPress={() => setPicking(false)} style={{ marginTop: 14 }} />
        </Card>
      ) : <Button title="Nuova scheda" icon="add" onPress={() => setPicking(true)} />}
      <Spacer />
      {programs.map(p => (
        <ListItem key={p.id} onPress={() => router.push(`/trainer/program/${p.id}`)}
          left={<Icon name="barbell" size={24} color={p.status === 'active' ? colors.accent : colors.muted} />}
          title={p.name}
          subtitle={`${p.weeks} settimane · ${p.sent_at ? `inviata ${timeAgo(p.sent_at)}` : `modificata ${timeAgo(p.updated_at)}`}`}
          right={<Badge label={PROGRAM_STATUS[p.status].label} color={PROGRAM_STATUS[p.status].color} />} />
      ))}
      {programs.length === 0 && !picking ? <Txt v="muted" center style={{ marginTop: 20 }}>Nessuna scheda per questo cliente.</Txt> : null}
      <Spacer h={6} />
      {programs.length > 0 ? <Txt v="small" center>Le bozze non sono visibili al cliente finché non le invii.</Txt> : null}
      {reviews.length > 0 ? (
        <>
          <SectionTitle>Questionari di fine scheda</SectionTitle>
          {reviews.map(r => (
            <ListItem key={r.id} onPress={() => router.push(`/trainer/review/${r.id}`)}
              left={<Icon name="clipboard" size={22} color={colors.accent} />}
              title={r.program_name || 'Scheda'}
              subtitle={`${fmtDate(r.created_at, true)} · ${reviewSummary(r)}`} />
          ))}
        </>
      ) : null}
    </View>
  );
}

function ProfileTab({ client, notes, onSaved }: { client: Client; notes: string; onSaved: (c: Client, n: string) => void }) {
  const [goal, setGoal] = useState(client.goal);
  const [height, setHeight] = useState(client.height_cm ? String(client.height_cm) : '');
  const [birth, setBirth] = useState(client.birth_date ?? '');
  const [status, setStatus] = useState(client.status);
  const [privNotes, setPrivNotes] = useState(notes);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return notify('Data non valida', 'Usa il formato AAAA-MM-GG, es. 1990-05-21');
    setBusy(true);
    const fields = { goal: goal.trim(), height_cm: height ? Number(height.replace(',', '.')) : null, birth_date: birth || null, status };
    const [a, b] = await Promise.all([
      supabase.from('clients').update(fields).eq('id', client.id),
      supabase.from('client_notes').upsert({ client_id: client.id, trainer_id: client.trainer_id, notes: privNotes, updated_at: new Date().toISOString() }),
    ]);
    setBusy(false);
    if (a.error || b.error) return notify('Errore', errorMessage(a.error || b.error));
    onSaved({ ...client, ...fields }, privNotes);
    notify('Salvato ✓');
  }

  async function archive() {
    if (!(await confirm('Archivia cliente', 'Il cliente non occuperà più un posto nel tuo piano, ma i suoi dati restano salvati.', 'Archivia'))) return;
    setStatus('archived');
  }

  return (
    <View>
      <Field label="Obiettivo" value={goal} onChangeText={setGoal} placeholder="es. Dimagrimento, ipertrofia, preparazione gara…" />
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label="Altezza (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1.4 }}><Field label="Data di nascita" value={birth} onChangeText={setBirth} placeholder="AAAA-MM-GG" /></View>
      </Row>
      <Txt v="label" style={{ marginBottom: 8 }}>Stato</Txt>
      <Segmented value={status} onChange={setStatus} options={[
        { value: 'active', label: 'Attivo' }, { value: 'paused', label: 'In pausa' }, { value: 'archived', label: 'Archiviato' },
      ]} />
      <Spacer h={16} />
      <Field label="Note private (il cliente non le vede)" value={privNotes} onChangeText={setPrivNotes} multiline
        placeholder="Anamnesi, infortuni, preferenze, scadenza abbonamento…" />
      <Button title="Salva" onPress={save} loading={busy} />
      {status !== 'archived' ? <Button title="Archivia cliente" variant="danger" small onPress={archive} style={{ marginTop: 24 }} /> : null}
      <SectionTitle>Info</SectionTitle>
      <Txt v="small">Cliente dal {fmtDate(client.created_at, true)}</Txt>
    </View>
  );
}

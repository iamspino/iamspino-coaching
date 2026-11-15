import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MuscleGroups } from '@/components/MuscleGroups';
import { reviewSummary } from '@/components/ReviewDetail';
import { Button, Card, ErrorText, Field, Icon, Loading, Row, Screen, SectionTitle, Spacer, Txt } from '@/components/ui';
import { colors } from '@/config';
import { fmtDate } from '@/lib/format';
import { useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { ProgramReview } from '@/lib/types';

/** Bozza AI della scheda successiva: mostra su cosa si basa e la genera. */
export default function AiDraft() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data } = useData(async () => {
    const [p, r, l] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', clientId).single(),
      supabase.from('program_reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
      supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', clientId).not('completed_at', 'is', null),
    ]);
    return { name: (p.data?.full_name as string) ?? '', review: ((r.data ?? []) as ProgramReview[])[0] ?? null, logs: l.count ?? 0 };
  }, [clientId]);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!data) return <Loading />;
  const first = data.name.split(' ')[0] || 'il cliente';

  async function generate() {
    setErr(''); setBusy(true);
    const { data: res, error } = await supabase.functions.invoke('draft-program', { body: { client_id: clientId, instructions: instructions.trim() } });
    if (error || !res?.program_id) {
      let msg = 'Non è stato possibile creare la bozza. Riprova.';
      try { msg = (await (error as { context?: Response })?.context?.json())?.error ?? msg; } catch { /* risposta non leggibile */ }
      setBusy(false);
      return setErr(msg);
    }
    router.replace(`/trainer/program/${res.program_id}`);
  }

  if (busy) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: 'Bozza con AI' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Txt v="h2" center style={{ marginTop: 20 }}>Sto preparando la bozza per {first}</Txt>
          <Txt v="muted" center style={{ marginTop: 8 }}>Analizzo questionario, carichi e gruppi muscolari. Può richiedere fino a un paio di minuti: non chiudere questa schermata.</Txt>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bozza con AI' }} />
      <Txt v="title">Prossima scheda di {first}</Txt>
      <Txt v="muted" style={{ marginTop: 6 }}>
        L'AI prepara una bozza partendo dai dati qui sotto. La trovi tra le schede come bozza: la controlli, la modifichi e decidi tu se inviarla.
      </Txt>

      <SectionTitle>Su cosa si basa</SectionTitle>
      {data.review ? (
        <Card onPress={() => router.push(`/trainer/review/${data.review!.id}`)}>
          <Row gap={8}><Icon name="clipboard" size={16} color={colors.accent} />
            <Txt v="label" color={colors.accent} style={{ flex: 1 }}>Questionario · {data.review.program_name} · {fmtDate(data.review.created_at)}</Txt></Row>
          <Txt v="small" style={{ marginTop: 6 }}>{reviewSummary(data.review)}</Txt>
          {data.review.next_goal ? <Txt style={{ marginTop: 6 }} numberOfLines={2}>🎯 {data.review.next_goal}</Txt> : null}
          {data.review.pain ? <Txt style={{ marginTop: 4 }} color={colors.red} numberOfLines={2}>⚠️ {data.review.pain}</Txt> : null}
        </Card>
      ) : (
        <Card><Txt v="muted">Nessun questionario di fine scheda. Per una bozza più mirata richiedilo al cliente dalla scheda attuale.</Txt></Card>
      )}
      <MuscleGroups clientId={clientId} />
      {data.logs === 0 ? <Card><Txt v="muted">Nessun allenamento registrato: la bozza sarà prudente e senza carichi suggeriti.</Txt></Card> : null}
      <Txt v="small">Vengono usati anche: scheda precedente, carichi recenti per esercizio, ultimi check-in, obiettivo e note private. Nome, email e foto del cliente non vengono inviati.</Txt>

      <Spacer h={18} />
      <Field label="Tue indicazioni (facoltative)" value={instructions} onChangeText={setInstructions} multiline maxLength={2000}
        placeholder="Es. 3 giorni, niente stacchi, più lavoro su glutei, mantieni la panca come primo esercizio" />
      <ErrorText>{err}</ErrorText>
      <Button title="Genera bozza" icon="sparkles" onPress={generate} />
    </Screen>
  );
}

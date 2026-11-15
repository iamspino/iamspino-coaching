import { router } from 'expo-router';
import { useState } from 'react';
import { ExerciseList } from '@/components/ExerciseList';
import { Button, Empty, Icon, ListItem, Screen, Segmented, Spacer, notify } from '@/components/ui';
import { colors } from '@/config';
import { timeAgo } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Program } from '@/lib/types';

type Tab = 'templates' | 'library';

export default function Programs() {
  const [tab, setTab] = useState<Tab>('templates');
  return (
    <Screen>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'templates', label: 'Modelli di scheda' }, { value: 'library', label: 'Libreria esercizi' },
      ]} />
      <Spacer h={14} />
      {tab === 'templates' ? <Templates /> : (
        <ExerciseList onSelect={e => router.push(`/trainer/exercise/${e.id}`)} header={
          <><Button title="Nuovo esercizio" icon="add" onPress={() => router.push('/trainer/exercise/new')} /><Spacer /></>
        } />
      )}
    </Screen>
  );
}

function Templates() {
  const { data } = useData(async () => must(await supabase.from('programs')
    .select('*, workouts(id)').is('client_id', null).order('updated_at', { ascending: false })) as Program[]);

  async function create() {
    const { data: p, error } = await supabase.from('programs').insert({ name: 'Nuovo modello' }).select().single();
    if (error) return notify('Errore', errorMessage(error));
    router.push(`/trainer/program/${p.id}`);
  }

  return (
    <>
      <Button title="Nuovo modello" icon="add" onPress={create} />
      <Spacer />
      {(data ?? []).map(p => (
        <ListItem key={p.id} onPress={() => router.push(`/trainer/program/${p.id}`)}
          left={<Icon name="document-text-outline" size={24} color={colors.blue} />}
          title={p.name}
          subtitle={`${p.weeks} settimane · ${p.workouts?.length ?? 0} allenamenti · ${timeAgo(p.updated_at)}`} />
      ))}
      {data && data.length === 0 ? (
        <Empty icon="documents-outline" title="Nessun modello"
          text="Crea schede riutilizzabili (es. 'Full body principiante') e assegnale ai clienti in un tocco." />
      ) : null}
    </>
  );
}

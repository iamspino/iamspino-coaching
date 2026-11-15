import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, MUSCLE_GROUPS } from '@/config';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/lib/types';
import { Badge, Chip, Field, Icon, ListItem, Txt } from './ui';

/** Libreria esercizi con ricerca e filtro per gruppo muscolare. */
export function ExerciseList({ onSelect, header }: { onSelect: (e: Exercise) => void; header?: React.ReactNode }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const { data } = useData(async () =>
    must(await supabase.from('exercises').select('*').order('name')) as Exercise[]);

  const list = (data ?? []).filter(e =>
    (!group || e.muscle_group === group) && (!mine || e.trainer_id) &&
    (!q || e.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <View>
      {header}
      <Field placeholder="Cerca esercizio…" value={q} onChangeText={setQ} autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        <Chip label="I miei" on={mine} onPress={() => setMine(!mine)} />
        {MUSCLE_GROUPS.map(g => <Chip key={g} label={g} on={group === g} onPress={() => setGroup(group === g ? null : g)} />)}
      </ScrollView>
      {list.map(e => (
        <ListItem key={e.id} onPress={() => onSelect(e)}
          title={e.name}
          subtitle={[e.muscle_group, e.equipment].filter(Boolean).join(' · ')}
          right={<View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {e.video_url ? <Icon name="videocam-outline" size={16} color={colors.muted2} /> : null}
            {e.trainer_id ? <Badge label="Mio" color={colors.blue} /> : null}
          </View>} />
      ))}
      {data && list.length === 0 ? <Txt v="muted" center style={{ marginTop: 20 }}>Nessun esercizio trovato.</Txt> : null}
    </View>
  );
}

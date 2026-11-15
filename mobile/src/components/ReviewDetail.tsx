import { Stack } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@/config';
import { fmtDate } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { ProgramReview } from '@/lib/types';
import { Card, Icon, Loading, Row, Screen, SectionTitle, Stat, Txt } from './ui';

const DIFFICULTY = ['Troppo facile', 'Facile', 'Giusta', 'Impegnativa', 'Troppo dura'];
const DURATION = ['Troppo corte', 'Un po\' corte', 'Giuste', 'Un po\' lunghe', 'Troppo lunghe'];

/** Riga riassuntiva di un questionario (per elenchi e per la creazione di una nuova scheda). */
export function reviewSummary(r: ProgramReview) {
  return [
    r.overall ? `Soddisfazione ${r.overall}/5` : '',
    r.difficulty ? `difficoltà: ${DIFFICULTY[r.difficulty - 1]!.toLowerCase()}` : '',
    r.days_per_week ? `${r.days_per_week} giorni/sett.` : '',
    r.session_minutes ? `${r.session_minutes} min` : '',
  ].filter(Boolean).join(' · ');
}

function TextBlock({ label, text, icon, color }: { label: string; text: string; icon: React.ComponentProps<typeof Icon>['name']; color?: string }) {
  if (!text) return null;
  return (
    <Card>
      <Row gap={8} style={{ marginBottom: 6 }}>
        <Icon name={icon} size={16} color={color ?? colors.muted2} />
        <Txt v="label" color={color}>{label}</Txt>
      </Row>
      <Txt>{text}</Txt>
    </Card>
  );
}

/** Questionario di fine scheda compilato dal cliente. */
export function ReviewDetail({ id }: { id: string }) {
  const { data: r } = useData(async () =>
    must(await supabase.from('program_reviews').select('*').eq('id', id).single()) as ProgramReview, [id]);
  if (!r) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Questionario finale' }} />
      <Txt v="title">{r.program_name || 'Scheda'}</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>Compilato il {fmtDate(r.created_at, true)}</Txt>

      <SectionTitle>Valutazione</SectionTitle>
      <Row gap={8}>
        <Stat value={r.overall ? `${r.overall}/5` : '—'} label="Soddisfazione" />
        <Stat value={r.enjoyment ? `${r.enjoyment}/5` : '—'} label="Gradimento" color={colors.blue} />
        <Stat value={r.results ? `${r.results}/5` : '—'} label="Risultati" color={colors.green} />
      </Row>
      <Row gap={8} style={{ marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Card><Txt v="label">Difficoltà</Txt>
            <Txt style={{ fontWeight: '700', marginTop: 4 }} color={r.difficulty === 3 ? colors.green : colors.accent}>
              {r.difficulty ? DIFFICULTY[r.difficulty - 1] : '—'}</Txt></Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card><Txt v="label">Durata sedute</Txt>
            <Txt style={{ fontWeight: '700', marginTop: 4 }} color={r.duration_ok === 3 ? colors.green : colors.accent}>
              {r.duration_ok ? DURATION[r.duration_ok - 1] : '—'}</Txt></Card>
        </View>
      </Row>

      <SectionTitle>Per la prossima scheda</SectionTitle>
      <Row gap={8} style={{ marginBottom: 10 }}>
        <Stat value={r.days_per_week ?? '—'} label="Giorni / sett." />
        <Stat value={r.session_minutes ? `${r.session_minutes}′` : '—'} label="Minuti a seduta" />
      </Row>
      <TextBlock label="Obiettivo" text={r.next_goal} icon="flag-outline" color={colors.accent} />
      <TextBlock label="Dolori o fastidi" text={r.pain} icon="medkit-outline" color={colors.red} />
      <TextBlock label="Cosa è piaciuto" text={r.liked} icon="thumbs-up-outline" color={colors.green} />
      <TextBlock label="Da cambiare o togliere" text={r.disliked} icon="thumbs-down-outline" />
      <TextBlock label="Altre note" text={r.notes} icon="document-text-outline" />
    </Screen>
  );
}

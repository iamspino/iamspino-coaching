import { View } from 'react-native';
import { colors } from '@/config';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, Icon, Row, Txt } from './ui';

export interface MuscleGroupRow {
  muscle_group: string;
  sets: number;
  sets_per_week: number;
  sessions: number;
  exercises: number;
  strength_change_pct: number | null;
}

/** Volume settimanale e andamento della forza per gruppo muscolare (ultime 8 settimane). */
export function MuscleGroups({ clientId }: { clientId: string }) {
  const { data } = useData(async () =>
    must(await supabase.rpc('muscle_group_progress', { p_client: clientId })) as MuscleGroupRow[], [clientId]);
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(g => Number(g.sets_per_week)));

  return (
    <Card>
      <Row style={{ marginBottom: 10 }}>
        <Txt v="label" style={{ flex: 1 }} numberOfLines={1}>Gruppi muscolari</Txt>
        <Txt v="label" style={{ width: 62, textAlign: 'right' }} numberOfLines={1}>Serie/s.</Txt>
        <Txt v="label" style={{ width: 66, textAlign: 'right' }}>Forza</Txt>
      </Row>
      {data.map(g => {
        const pct = g.strength_change_pct === null ? null : Number(g.strength_change_pct);
        const color = pct === null ? colors.muted : pct >= 2 ? colors.green : pct <= -2 ? colors.red : colors.warn;
        const icon = pct === null ? 'remove' : pct >= 2 ? 'trending-up' : pct <= -2 ? 'trending-down' : 'remove';
        return (
          <View key={g.muscle_group} style={{ marginBottom: 10 }}>
            <Row>
              <Txt style={{ flex: 1, fontWeight: '600' }}>{g.muscle_group}</Txt>
              <Txt style={{ width: 62, textAlign: 'right', fontWeight: '700' }}>{String(Number(g.sets_per_week)).replace('.', ',')}</Txt>
              <Row gap={4} style={{ width: 66, justifyContent: 'flex-end' }}>
                <Icon name={icon} size={14} color={color} />
                <Txt color={color} style={{ fontWeight: '700' }}>
                  {pct === null ? '—' : `${pct > 0 ? '+' : ''}${String(pct).replace('.', ',')}%`}
                </Txt>
              </Row>
            </Row>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surface3, marginTop: 5 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.accent, width: `${max ? (Number(g.sets_per_week) / max) * 100 : 0}%` }} />
            </View>
          </View>
        );
      })}
      <Txt v="small">Ultime 8 settimane. Serie/s. = serie a settimana. Forza = variazione del massimale stimato tra le prime e le ultime sedute.</Txt>
    </Card>
  );
}

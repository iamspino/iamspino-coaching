import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors } from '@/config';
import { estimated1RM, fmtDate, fmtDuration } from '@/lib/format';
import { must, useData } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { CheckIn, WorkoutLog } from '@/lib/types';
import { LineChart } from './LineChart';
import { Badge, Card, Chip, Empty, Icon, ListItem, Row, SectionTitle, Segmented, Txt } from './ui';

type Tab = 'body' | 'strength' | 'history';

/**
 * Progressi di un cliente: misure corporee, forza (massimale stimato) e storico allenamenti.
 * Usato sia dal trainer (scheda cliente) sia dal cliente.
 */
export function ProgressView({ clientId, basePath }: { clientId: string; basePath: '/trainer' | '/client' }) {
  const [tab, setTab] = useState<Tab>('body');
  const { data } = useData(async () => {
    const [checkins, logs] = await Promise.all([
      supabase.from('check_ins').select('*').eq('client_id', clientId).order('date', { ascending: true }),
      supabase.from('workout_logs').select('*, set_logs(*)').eq('client_id', clientId)
        .not('completed_at', 'is', null).order('started_at', { ascending: false }).limit(200),
    ]);
    return { checkins: must(checkins) as CheckIn[], logs: must(logs) as WorkoutLog[] };
  }, [clientId]);

  return (
    <View>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'body', label: 'Corpo' }, { value: 'strength', label: 'Forza' }, { value: 'history', label: 'Diario' },
      ]} />
      {!data ? null : tab === 'body' ? <BodyTab checkins={data.checkins} basePath={basePath} />
        : tab === 'strength' ? <StrengthTab logs={data.logs} />
        : <HistoryTab logs={data.logs} basePath={basePath} />}
    </View>
  );
}

const MEASURES: { key: keyof CheckIn; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Peso', unit: ' kg', color: colors.accent },
  { key: 'body_fat', label: 'Massa grassa', unit: '%', color: colors.red },
  { key: 'waist', label: 'Vita', unit: ' cm', color: colors.blue },
  { key: 'hips', label: 'Fianchi', unit: ' cm', color: colors.purple },
  { key: 'chest', label: 'Petto', unit: ' cm', color: colors.green },
  { key: 'arm', label: 'Braccio', unit: ' cm', color: colors.blue },
  { key: 'thigh', label: 'Coscia', unit: ' cm', color: colors.purple },
];

function BodyTab({ checkins, basePath }: { checkins: CheckIn[]; basePath: string }) {
  const available = MEASURES.filter(m => checkins.some(c => c[m.key] != null));
  const [measure, setMeasure] = useState(available[0]?.key ?? 'weight');
  const m = MEASURES.find(x => x.key === measure) ?? MEASURES[0]!;
  const points = checkins.filter(c => c[m.key] != null).map(c => ({ date: c.date, value: Number(c[m.key]) }));

  if (checkins.length === 0) return <Empty icon="body-outline" title="Nessun check-in" text="I check-in con peso, misure e foto appariranno qui." />;
  return (
    <View>
      {available.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }} contentContainerStyle={{ gap: 8 }}>
            {available.map(x => <Chip key={x.key} label={x.label} on={x.key === measure} onPress={() => setMeasure(x.key)} />)}
          </ScrollView>
          <Card><LineChart points={points} unit={m.unit} color={m.color} /></Card>
        </>
      ) : null}
      <SectionTitle>Check-in</SectionTitle>
      {[...checkins].reverse().map(c => (
        <ListItem key={c.id}
          onPress={() => router.push(`${basePath}/checkin/${c.id}` as never)}
          left={<Icon name={c.photos.length ? 'images-outline' : 'clipboard-outline'} size={22} color={colors.accent} />}
          title={fmtDate(c.date, true)}
          subtitle={[c.weight ? `${c.weight} kg` : '', c.photos.length ? `${c.photos.length} foto` : '', c.notes].filter(Boolean).join(' · ') || 'Check-in'}
          right={c.reviewed_at ? <Icon name="checkmark-done" size={18} color={colors.green} /> : <Badge label="Da vedere" color={colors.red} />}
        />
      ))}
    </View>
  );
}

function StrengthTab({ logs }: { logs: WorkoutLog[] }) {
  // Massimale stimato per sessione, per ogni esercizio
  const series = useMemo(() => {
    const byEx = new Map<string, { name: string; points: { date: string; value: number }[] }>();
    for (const log of [...logs].reverse()) {
      const best = new Map<string, { name: string; v: number }>();
      for (const s of log.set_logs ?? []) {
        if (!s.done || !s.load || !s.reps) continue;
        const key = s.exercise_id ?? s.exercise_name;
        const v = estimated1RM(Number(s.load), Number(s.reps));
        if (v > (best.get(key)?.v ?? 0)) best.set(key, { name: s.exercise_name, v });
      }
      best.forEach((b, key) => {
        if (!byEx.has(key)) byEx.set(key, { name: b.name, points: [] });
        byEx.get(key)!.points.push({ date: log.started_at, value: b.v });
      });
    }
    return [...byEx.entries()].sort((a, b) => b[1].points.length - a[1].points.length);
  }, [logs]);
  const [sel, setSel] = useState<string | null>(null);
  const current = series.find(([k]) => k === sel) ?? series[0];

  if (!current) return <Empty icon="barbell-outline" title="Nessun dato di forza" text="Completa degli allenamenti segnando i kg per vedere i progressi." />;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }} contentContainerStyle={{ gap: 8 }}>
        {series.map(([k, v]) => <Chip key={k} label={v.name} on={k === current[0]} onPress={() => setSel(k)} />)}
      </ScrollView>
      <Card>
        <Txt v="label" style={{ marginBottom: 6 }}>Massimale stimato · {current[1].name}</Txt>
        <LineChart points={current[1].points} unit=" kg" />
      </Card>
      <Txt v="small">Il massimale è stimato dalla serie migliore di ogni allenamento (formula di Epley).</Txt>
    </View>
  );
}

function HistoryTab({ logs, basePath }: { logs: WorkoutLog[]; basePath: string }) {
  if (logs.length === 0) return <Empty icon="calendar-outline" title="Nessun allenamento" text="Gli allenamenti completati appariranno qui." />;
  return (
    <View style={{ marginTop: 14 }}>
      {logs.map(l => {
        const vol = (l.set_logs ?? []).reduce((s, x) => s + (x.done ? Number(x.load || 0) * Number(x.reps || 0) : 0), 0);
        return (
          <ListItem key={l.id} onPress={() => router.push(`${basePath}/log/${l.id}` as never)}
            left={<Icon name="checkmark-circle" size={24} color={colors.green} />}
            title={l.workout_name || 'Allenamento'}
            subtitle={[fmtDate(l.started_at, true), fmtDuration(l.started_at, l.completed_at), vol ? `${Math.round(vol)} kg volume` : ''].filter(Boolean).join(' · ')}
            right={l.trainer_comment ? <Icon name="chatbox-ellipses-outline" size={18} color={colors.accent} /> : null}
          />
        );
      })}
    </View>
  );
}

export function FeelingRow({ value }: { value: number | null }) {
  if (!value) return null;
  const faces = ['😫', '😕', '😐', '🙂', '💪'];
  return <Row gap={6}><Txt>{faces[value - 1]}</Txt><Txt v="muted">Sensazione {value}/5</Txt></Row>;
}

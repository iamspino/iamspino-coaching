import { useState } from 'react';
import { Linking, View } from 'react-native';
import { APP_NAME, colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { Avatar, Button, Card, Field, Row, Screen, SectionTitle, Spacer, Txt, confirm, notify } from './ui';

const PLANS = [
  { id: 'starter', name: 'Starter', clients: 15, price: '19 €/mese' },
  { id: 'pro', name: 'Pro', clients: 50, price: '39 €/mese' },
  { id: 'studio', name: 'Studio', clients: 200, price: '79 €/mese' },
];

export function AccountSettings() {
  const { profile, trainer, session, signOut, refresh } = useAuth();
  const isTrainer = profile?.role === 'trainer';
  const [name, setName] = useState(profile?.full_name ?? '');
  const [business, setBusiness] = useState(trainer?.business_name ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const a = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile!.id);
    const b = isTrainer ? await supabase.from('trainers').update({ business_name: business.trim() }).eq('id', profile!.id) : { error: null };
    setBusy(false);
    if (a.error || b.error) return notify('Errore', errorMessage(a.error || b.error));
    await refresh();
    notify('Salvato ✓');
  }

  async function deleteAccount() {
    const msg = isTrainer
      ? 'Verranno eliminati definitivamente il tuo account, tutti i tuoi clienti, schede e dati. L\'operazione non è reversibile.'
      : 'Verranno eliminati definitivamente il tuo account, i tuoi allenamenti, check-in e messaggi. L\'operazione non è reversibile.';
    if (!(await confirm('Elimina account', msg, 'Elimina definitivamente'))) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return notify('Errore', errorMessage(error));
    await signOut();
  }

  return (
    <Screen>
      <Row gap={14} style={{ marginBottom: 20 }}>
        <Avatar name={profile?.full_name ?? ''} size={56} />
        <View style={{ flex: 1 }}>
          <Txt v="h2">{profile?.full_name}</Txt>
          <Txt v="muted">{session?.user.email}</Txt>
        </View>
      </Row>

      {!isTrainer && trainer ? (
        <Card><Txt v="label">Il tuo coach</Txt><Txt v="h2" style={{ marginTop: 4 }}>{trainer.business_name || 'Personal trainer'}</Txt></Card>
      ) : null}

      <SectionTitle>Profilo</SectionTitle>
      <Field label="Nome e cognome" value={name} onChangeText={setName} />
      {isTrainer ? <Field label="Nome attività" value={business} onChangeText={setBusiness} /> : null}
      <Button title="Salva" onPress={save} loading={busy} />

      {isTrainer && trainer ? (
        <>
          <SectionTitle>Abbonamento</SectionTitle>
          <Card highlight>
            <Txt v="h2">{trainer.plan === 'trial' ? 'Prova gratuita' : `Piano ${trainer.plan[0]!.toUpperCase()}${trainer.plan.slice(1)}`}</Txt>
            <Txt v="muted" style={{ marginTop: 4 }}>
              Fino a {trainer.max_clients} clienti{trainer.plan === 'trial' ? ` · scade il ${fmtDate(trainer.trial_ends_at, true)}` : ''}
            </Txt>
          </Card>
          {PLANS.map(p => (
            <Card key={p.id}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{p.name}</Txt>
                  <Txt v="small">Fino a {p.clients} clienti · schede, chat, check-in illimitati</Txt>
                </View>
                <Txt color={colors.accent} style={{ fontWeight: '800' }}>{p.price}</Txt>
              </Row>
            </Card>
          ))}
          <Txt v="small">I pagamenti online saranno attivati a breve. Per passare a un piano superiore contattaci.</Txt>
        </>
      ) : null}

      <SectionTitle>Account</SectionTitle>
      <Button title="Esci" variant="ghost" icon="log-out-outline" onPress={signOut} />
      <Spacer h={10} />
      <Button title="Privacy e termini" variant="ghost" small onPress={() => Linking.openURL('https://example.com/privacy')} />
      <Button title="Elimina account" variant="danger" small onPress={deleteAccount} style={{ marginTop: 28 }} />
      <Txt v="small" center style={{ marginTop: 20 }}>{APP_NAME} · v1.0</Txt>
    </Screen>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ErrorText, Field, Screen, Spacer, Txt } from '@/components/ui';
import { colors } from '@/config';
import { shareInvite } from '@/lib/invite';
import { useAuth } from '@/lib/auth';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Invite } from '@/lib/types';

export default function InviteScreen() {
  const { profile, trainer } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setErr(''); setBusy(true);
    const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).neq('status', 'archived');
    if (trainer && (count ?? 0) >= trainer.max_clients) {
      setBusy(false);
      return setErr(`Hai raggiunto il limite di ${trainer.max_clients} clienti del tuo piano. Archivia un cliente o passa a un piano superiore.`);
    }
    const { data, error } = await supabase.from('client_invites')
      .insert({ full_name: name.trim(), email: email.trim() || null }).select().single();
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setInvite(data as Invite);
  }

  if (invite) {
    return (
      <Screen>
        <Txt v="title">Invito pronto ✅</Txt>
        <Txt v="muted" style={{ marginTop: 6, marginBottom: 18 }}>Manda il codice a {invite.full_name || 'il tuo cliente'}. È valido per una sola registrazione.</Txt>
        <Card highlight style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Txt v="label">Codice invito</Txt>
          <Txt style={{ fontSize: 38, fontWeight: '900', letterSpacing: 6, marginTop: 6 }} color={colors.accent}>{invite.code}</Txt>
        </Card>
        <Spacer />
        <Button title="Condividi invito" icon="share-social-outline" onPress={() => shareInvite(invite.code, invite.full_name, profile?.full_name)} />
        <Spacer h={10} />
        <Button title="Fatto" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt v="muted" style={{ marginBottom: 18 }}>
        Crea un codice personale per il tuo cliente. Quando si registra con il codice, lo trovi subito nella lista clienti.
      </Txt>
      <Field label="Nome del cliente" value={name} onChangeText={setName} placeholder="es. Mario Rossi" autoFocus />
      <Field label="Email (facoltativa)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <ErrorText>{err}</ErrorText>
      <View><Button title="Crea invito" onPress={create} loading={busy} /></View>
    </Screen>
  );
}

import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Card, ErrorText, Field, Screen, Spacer, Txt, notify } from '@/components/ui';
import { colors } from '@/config';
import { errorMessage, supabase } from '@/lib/supabase';

interface InviteInfo { full_name: string; business_name: string; trainer_name: string }

export default function SignupClient() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(c = code) {
    setErr(''); setBusy(true);
    const { data, error } = await supabase.rpc('check_invite', { invite_code: c.trim() });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    const info = (data as InviteInfo[])[0];
    if (!info) return setErr('Codice non valido o già usato. Chiedi al tuo coach un nuovo invito.');
    setInvite(info);
    if (info.full_name && !name) setName(info.full_name);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.code) verify(params.code); }, [params.code]);

  async function submit() {
    setErr('');
    if (!name.trim()) return setErr('Inserisci il tuo nome.');
    if (password.length < 8) return setErr('La password deve avere almeno 8 caratteri.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { role: 'client', full_name: name.trim(), invite_code: code.trim().toUpperCase() } },
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    if (!data.session) notify('Controlla la tua email', 'Ti abbiamo inviato un link per confermare l\'account.');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Unisciti al tuo coach' }} />
      {!invite ? (
        <>
          <Txt v="title">Codice invito</Txt>
          <Txt v="muted" style={{ marginTop: 6, marginBottom: 20 }}>Inserisci il codice che ti ha mandato il tuo personal trainer.</Txt>
          <Field value={code} onChangeText={t => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false}
            placeholder="ES. 7F3A9C21" maxLength={12} style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center', fontWeight: '800' }} />
          <ErrorText>{err}</ErrorText>
          <Button title="Continua" onPress={() => verify()} loading={busy} disabled={code.trim().length < 6} />
        </>
      ) : (
        <>
          <Card highlight>
            <Txt v="label">Il tuo coach</Txt>
            <Txt v="h2" style={{ marginTop: 4 }}>{invite.trainer_name}</Txt>
            {invite.business_name ? <Txt v="muted" color={colors.accent}>{invite.business_name}</Txt> : null}
          </Card>
          <Spacer h={10} />
          <Field label="Nome e cognome" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="Almeno 8 caratteri" />
          <ErrorText>{err}</ErrorText>
          <Button title="Crea account" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}

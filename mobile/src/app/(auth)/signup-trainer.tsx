import { Stack } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Screen, Spacer, Txt, notify } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';

export default function SignupTrainer() {
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (!name.trim()) return setErr('Inserisci il tuo nome.');
    if (password.length < 8) return setErr('La password deve avere almeno 8 caratteri.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { role: 'trainer', full_name: name.trim(), business_name: business.trim() } },
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    if (!data.session) notify('Controlla la tua email', 'Ti abbiamo inviato un link per confermare l\'account.');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Account trainer' }} />
      <Txt v="title">Crea il tuo studio</Txt>
      <Txt v="muted" style={{ marginTop: 6, marginBottom: 20 }}>30 giorni di prova gratuita, fino a 10 clienti. Nessuna carta richiesta.</Txt>
      <Field label="Nome e cognome" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Nome attività (facoltativo)" value={business} onChangeText={setBusiness} placeholder="es. Rossi Training" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="Almeno 8 caratteri" />
      <ErrorText>{err}</ErrorText>
      <Button title="Crea account" onPress={submit} loading={busy} />
      <Spacer h={12} />
      <Txt v="small" center>Registrandoti accetti i Termini di servizio e l'Informativa privacy.</Txt>
    </Screen>
  );
}

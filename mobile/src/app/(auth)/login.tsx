import { Stack } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Screen, Spacer, Txt, notify } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(errorMessage(error));
  }

  async function forgot() {
    if (!email.trim()) { setErr('Scrivi la tua email e poi premi "Password dimenticata".'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setErr(errorMessage(error));
    else notify('Email inviata', 'Controlla la posta per reimpostare la password.');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Accedi' }} />
      <Txt v="title">Bentornato 👋</Txt>
      <Spacer h={20} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <ErrorText>{err}</ErrorText>
      <Button title="Accedi" onPress={submit} loading={busy} />
      <Spacer h={12} />
      <Button title="Password dimenticata" variant="ghost" small onPress={forgot} />
    </Screen>
  );
}

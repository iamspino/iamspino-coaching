import { Redirect } from 'expo-router';
import { Button, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function Index() {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (profile?.role === 'trainer') return <Redirect href="/trainer" />;
  if (profile?.role === 'client') return <Redirect href="/client" />;
  return (
    <Screen edges={['top', 'bottom']}>
      <Txt v="title">Profilo non trovato</Txt>
      <Txt v="muted" style={{ marginVertical: 12 }}>Il tuo account non è collegato a nessun profilo. Esci e riprova.</Txt>
      <Button title="Esci" onPress={signOut} />
    </Screen>
  );
}

import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { screenOptions } from '@/lib/nav';

export default function TrainerLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || profile?.role !== 'trainer') return <Redirect href="/" />;
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="invite" options={{ title: 'Invita cliente', presentation: 'modal' }} />
      <Stack.Screen name="pick-exercise" options={{ title: 'Scegli esercizio', presentation: 'modal' }} />
      <Stack.Screen name="exercise/[id]" options={{ title: 'Esercizio', presentation: 'modal' }} />
    </Stack>
  );
}

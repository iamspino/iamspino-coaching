import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { screenOptions } from '@/lib/nav';

export default function ClientLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || profile?.role !== 'client') return <Redirect href="/" />;
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="workout/[id]" options={{ title: 'Allenamento', gestureEnabled: false }} />
      <Stack.Screen name="checkin/new" options={{ title: 'Nuovo check-in', presentation: 'modal' }} />
    </Stack>
  );
}

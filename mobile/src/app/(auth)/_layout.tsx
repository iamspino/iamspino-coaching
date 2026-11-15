import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { screenOptions } from '@/lib/nav';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ ...screenOptions, title: '' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}

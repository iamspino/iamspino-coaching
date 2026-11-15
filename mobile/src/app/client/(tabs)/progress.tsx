import { router } from 'expo-router';
import { ProgressView } from '@/components/Progress';
import { Button, Loading, Screen, Spacer } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function ClientProgress() {
  const { profile } = useAuth();
  if (!profile) return <Loading />;
  return (
    <Screen>
      <Button title="Nuovo check-in" icon="add-circle-outline" onPress={() => router.push('/client/checkin/new')} />
      <Spacer h={14} />
      <ProgressView clientId={profile.id} basePath="/client" />
    </Screen>
  );
}

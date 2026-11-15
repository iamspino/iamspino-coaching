import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Chat } from '@/components/Chat';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function TrainerChat() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', clientId).single().then(({ data }) => setName(data?.full_name ?? ''));
  }, [clientId]);
  if (!profile) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <Chat clientId={clientId} myId={profile.id} emptyText={`Scrivi il primo messaggio a ${name.split(' ')[0] || 'questo cliente'}.`} />
    </>
  );
}

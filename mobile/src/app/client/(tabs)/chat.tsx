import { Chat } from '@/components/Chat';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function ClientChat() {
  const { profile } = useAuth();
  if (!profile) return <Loading />;
  return <Chat clientId={profile.id} myId={profile.id} emptyText="Scrivi al tuo coach: domande, dubbi sugli esercizi, come ti senti." />;
}

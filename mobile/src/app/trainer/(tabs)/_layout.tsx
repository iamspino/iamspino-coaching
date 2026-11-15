import { Tabs } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { onMessagesRead } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const tab = (icon: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} size={size} color={color as string} />;

export default function TrainerTabs() {
  const unread = useUnread();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '800' },
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tab('home-outline') }} />
      <Tabs.Screen name="clients" options={{ title: 'Clienti', tabBarIcon: tab('people-outline') }} />
      <Tabs.Screen name="programs" options={{ title: 'Schede', tabBarIcon: tab('barbell-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Chat', tabBarIcon: tab('chatbubbles-outline'), tabBarBadge: unread || undefined }} />
      <Tabs.Screen name="settings" options={{ title: 'Profilo', tabBarIcon: tab('person-circle-outline') }} />
    </Tabs>
  );
}

/** Numero di messaggi non letti, aggiornato in tempo reale. */
function useUnread() {
  const { profile } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!profile) return;
    const load = () => supabase.from('messages').select('id', { count: 'exact', head: true })
      .neq('sender_id', profile.id).is('read_at', null).then(({ count }) => setN(count ?? 0));
    load();
    const ch = supabase.channel('unread-trainer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load).subscribe();
    const off = onMessagesRead(load);
    return () => { off(); supabase.removeChannel(ch); };
  }, [profile]);
  return n;
}

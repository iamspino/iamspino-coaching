import { Tabs } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import { colors } from '@/config';
import { useAuth } from '@/lib/auth';
import { onMessagesRead } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const tab = (icon: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} size={size} color={color as string} />;

export default function ClientTabs() {
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!profile) return;
    const load = () => supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('client_id', profile.id).neq('sender_id', profile.id).is('read_at', null).then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase.channel('unread-client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${profile.id}` }, load).subscribe();
    const off = onMessagesRead(load);
    return () => { off(); supabase.removeChannel(ch); };
  }, [profile]);

  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '800' },
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Oggi', tabBarIcon: tab('flash-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progressi', tabBarIcon: tab('trending-up-outline') }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: tab('chatbubbles-outline'), tabBarBadge: unread || undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: tab('person-circle-outline') }} />
    </Tabs>
  );
}

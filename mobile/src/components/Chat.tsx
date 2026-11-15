import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/config';
import { fmtDate, fmtTime } from '@/lib/format';
import { emitMessagesRead } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';
import { Icon, Loading, Txt } from './ui';

export function Chat({ clientId, myId, emptyText }: { clientId: string; myId: string; emptyText: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const headerHeight = useSafeHeaderHeight();
  const listRef = useRef<FlatList<Message>>(null);

  const markRead = useCallback(async () => {
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('client_id', clientId).neq('sender_id', myId).is('read_at', null);
    emitMessagesRead();
  }, [clientId, myId]);

  useEffect(() => {
    let alive = true;
    supabase.from('messages').select('*').eq('client_id', clientId)
      .order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { if (alive) setMessages((data as Message[]) ?? []); });
    markRead();
    const channel = supabase.channel(`chat-${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        payload => {
          const m = payload.new as Message;
          setMessages(prev => prev && !prev.some(x => x.id === m.id) ? [m, ...prev] : prev);
          if (m.sender_id !== myId) markRead();
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [clientId, myId, markRead]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({ client_id: clientId, body }).select().single();
    setSending(false);
    if (!error && data) {
      setText('');
      setMessages(prev => prev && !prev.some(x => x.id === data.id) ? [data as Message, ...prev] : prev);
    }
  }

  if (!messages) return <Loading />;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
        <FlatList
          ref={listRef}
          inverted={messages.length > 0}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 14, flexGrow: 1 }}
          ListEmptyComponent={<View style={{ flex: 1, justifyContent: 'center', padding: 30 }}><Txt v="muted" center>{emptyText}</Txt></View>}
          renderItem={({ item, index }) => {
            const mine = item.sender_id === myId;
            const older = messages[index + 1];
            const newDay = !older || older.created_at.slice(0, 10) !== item.created_at.slice(0, 10);
            return (
              <View>
                {newDay ? <Txt v="small" center style={{ marginVertical: 10 }}>{fmtDate(item.created_at, true)}</Txt> : null}
                <View style={[st.bubble, mine ? st.mine : st.theirs]}>
                  <Text style={[st.text, mine && { color: colors.accentText }]}>{item.body}</Text>
                  <Text style={[st.time, mine && { color: '#00000088' }]}>
                    {fmtTime(item.created_at)}{mine && item.read_at ? ' · letto' : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        <View style={st.inputBar}>
          <TextInput
            value={text} onChangeText={setText} placeholder="Scrivi un messaggio…" placeholderTextColor={colors.muted}
            style={st.input} multiline maxLength={4000}
          />
          <Pressable onPress={send} style={[st.send, !text.trim() && { opacity: 0.4 }]} accessibilityLabel="Invia">
            <Icon name="send" size={18} color={colors.accentText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useSafeHeaderHeight() {
  try { return useHeaderHeight(); } catch { return 0; }
}

const st = StyleSheet.create({
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, marginVertical: 3 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderBottomLeftRadius: 5 },
  text: { color: colors.text, fontSize: 15.5, lineHeight: 21 },
  time: { color: colors.muted, fontSize: 10.5, marginTop: 2, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.surface2, color: colors.text, borderRadius: 20, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15.5, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/config';
import { Icon } from './ui';

/** Timer di recupero fisso in basso. `endAt` = timestamp di fine (null = nascosto). */
export function RestTimer({ endAt, label, onAdd, onClose }: { endAt: number | null; label: string; onAdd: (s: number) => void; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fired.current = false;
    if (!endAt) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [endAt]);

  const left = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : 0;
  useEffect(() => {
    if (endAt && left === 0 && !fired.current) {
      fired.current = true;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Vibration.vibrate([0, 300, 150, 300]);
      }
      const t = setTimeout(onClose, 5000);
      return () => clearTimeout(t);
    }
  }, [left, endAt, onClose]);

  if (!endAt) return null;
  const done = left === 0;
  return (
    <View style={[st.wrap, { bottom: 12 + insets.bottom }, done && { borderColor: colors.green }]}>
      <Text style={[st.time, done && { color: colors.green }]}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</Text>
      <Text style={st.label} numberOfLines={2}>{done ? 'Recupero finito, vai! 💪' : `Recupero · ${label}`}</Text>
      <Pressable style={st.btn} onPress={() => onAdd(15)}><Text style={st.btnText}>+15″</Text></Pressable>
      <Pressable style={st.btn} onPress={onClose} accessibilityLabel="Chiudi timer"><Icon name="close" size={18} color={colors.text} /></Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.accent, borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 12, maxWidth: 696, alignSelf: 'center',
  },
  time: { color: colors.accent, fontSize: 38, fontWeight: '900', minWidth: 92, fontVariant: ['tabular-nums'] },
  label: { flex: 1, color: colors.muted2, fontSize: 13 },
  btn: { backgroundColor: colors.surface3, borderRadius: 10, paddingHorizontal: 12, height: 40, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.text, fontWeight: '700' },
});

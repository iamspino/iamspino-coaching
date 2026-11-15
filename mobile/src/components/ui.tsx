import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/config';
import { initials } from '@/lib/format';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = Ionicons;

// ── LAYOUT ───────────────────────────────────────────────────────────────────
export function Screen({ children, scroll = true, edges = ['bottom'], onRefresh, refreshing = false, padded = true, style }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; onRefresh?: () => void; refreshing?: boolean;
  padded?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const inner = padded ? s.padded : undefined;
  return (
    <SafeAreaView edges={edges} style={[s.screen, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
        >
          <View style={s.maxW}>{children}</View>
        </ScrollView>
      ) : <View style={[{ flex: 1 }, inner]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Row({ children, gap = 10, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Spacer({ h = 12 }: { h?: number }) { return <View style={{ height: h }} />; }

// ── TESTO ────────────────────────────────────────────────────────────────────
type TxtVariant = 'display' | 'title' | 'h2' | 'body' | 'muted' | 'small' | 'label';
export function Txt({ children, v = 'body', color, style, numberOfLines, center }: {
  children: ReactNode; v?: TxtVariant; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number; center?: boolean;
}) {
  return <Text numberOfLines={numberOfLines} style={[s[v], color ? { color } : null, center && { textAlign: 'center' }, style]}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
      <Txt v="label">{children}</Txt>{right}
    </Row>
  );
}

// ── CARD ─────────────────────────────────────────────────────────────────────
export function Card({ children, onPress, style, highlight }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; highlight?: boolean;
}) {
  const st = [s.card, highlight && { borderColor: colors.accent }, style];
  if (!onPress) return <View style={st}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st, pressed && { backgroundColor: colors.surface2 }]}>
      {children}
    </Pressable>
  );
}

export function ListItem({ title, subtitle, left, right, onPress, chevron = true }: {
  title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; onPress?: () => void; chevron?: boolean;
}) {
  return (
    <Card onPress={onPress} style={{ paddingVertical: 12 }}>
      <Row gap={12}>
        {left}
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof title === 'string' ? <Txt style={{ fontWeight: '600' }} numberOfLines={1}>{title}</Txt> : title}
          {subtitle ? (typeof subtitle === 'string' ? <Txt v="small" numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Txt> : subtitle) : null}
        </View>
        {right}
        {onPress && chevron ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}
      </Row>
    </Card>
  );
}

// ── BOTTONI ──────────────────────────────────────────────────────────────────
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'success'; icon?: IconName;
  loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.accent, ghost: 'transparent', danger: 'transparent', success: colors.green }[variant];
  const fg = { primary: colors.accentText, ghost: colors.text, danger: colors.red, success: '#000' }[variant];
  const border = variant === 'ghost' ? colors.surface3 : variant === 'danger' ? colors.red : bg;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={loading || disabled ? undefined : onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, borderColor: border },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.text, size = 22, label }: {
  name: IconName; onPress: () => void; color?: string; size?: number; label?: string;
}) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={10} onPress={onPress} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// ── INPUT ────────────────────────────────────────────────────────────────────
export function Field({ label, style, hint, ...props }: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Txt v="label" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
        {...props}
      />
      {hint ? <Txt v="small" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, value === o.value && s.segOn]}>
          <Text style={[s.segText, value === o.value && { color: colors.accentText }]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[s.chipText, on && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/** Scala 1-5 (sonno, energia, ecc.) */
export function Scale({ label, value, onChange, low, high }: {
  label: string; value: number | null; onChange: (v: number) => void; low: string; high: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="label" style={{ marginBottom: 8 }}>{label}</Txt>
      <Row gap={8}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => onChange(n)} style={[s.scaleItem, value === n && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <Text style={[s.scaleText, value === n && { color: colors.accentText }]}>{n}</Text>
          </Pressable>
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><Txt v="small">{low}</Txt><Txt v="small">{high}</Txt></Row>
    </View>
  );
}

// ── VARIE ────────────────────────────────────────────────────────────────────
export function Badge({ label, color = colors.accent, solid }: { label: string; color?: string; solid?: boolean }) {
  return (
    <View style={[s.badge, { borderColor: color + '66', backgroundColor: solid ? color : color + '22' }]}>
      <Text style={[s.badgeText, { color: solid ? '#000' : color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Stat({ value, label, color = colors.accent }: { value: ReactNode; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Txt v="label" style={{ fontSize: 10 }} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

export function Empty({ icon = 'albums-outline', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={44} color={colors.muted} />
      <Txt v="h2" center style={{ marginTop: 12 }}>{title}</Txt>
      {text ? <Txt v="muted" center style={{ marginTop: 6, maxWidth: 320 }}>{text}</Txt> : null}
      {action ? <View style={{ marginTop: 18, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={colors.accent} size="large" /></View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Txt color={colors.red} style={{ marginBottom: 12 }}>{children}</Txt>;
}

/** Conferma che funziona sia su telefono che su web. */
export function confirm(title: string, message: string, okLabel = 'Conferma', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: 16, paddingTop: 12 },
  maxW: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  display: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted2, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 12.5, lineHeight: 17 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1 },
  btnSmall: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontSize: 15, fontWeight: '700' },
  iconBtn: { padding: 6 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, fontSize: 16, paddingHorizontal: 14, minHeight: 48 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: colors.accent },
  segText: { color: colors.muted2, fontWeight: '700', fontSize: 13 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.surface3 },
  chipText: { color: colors.muted2, fontWeight: '600', fontSize: 13 },
  scaleItem: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.surface3, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  scaleText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  avatar: { backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, minWidth: 0 },
  statValue: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
});

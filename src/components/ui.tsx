import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  Appearance,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import type { Status } from '../lib/format';

const light = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  text: '#1C1B1A',
  muted: '#6B6760',
  border: '#E4E0D8',
  primary: '#1F4E8C',
  primaryText: '#FFFFFF',
  danger: '#C0392B',
  warn: '#D68910',
  good: '#1E8449',
};

const dark: typeof light = {
  bg: '#121212',
  card: '#1E1E1E',
  text: '#ECEAE6',
  muted: '#A19D96',
  border: '#33312E',
  primary: '#7FA8E0',
  primaryText: '#0E1A2B',
  danger: '#F1817A',
  warn: '#F2B854',
  good: '#6CC58D',
};

/** Follows the phone's light/dark setting (picked when the app starts). */
export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;

/** One accent color per item (by its position), used for the stripe and icon background. */
const ACCENTS = ['#2E86DE', '#E67E22', '#27AE60', '#8E44AD', '#16A085', '#C0392B', '#D4AC0D', '#7F8C8D'];
export const accentFor = (index: number) => ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];

/** Spending colors by entry kind (troubleshooting circles use colors.danger). */
export const kindColor = { Service: colors.primary, Repair: colors.warn, Fee: '#8E44AD' } as const;

export const statusColor: Record<Status, string> = {
  Overdue: colors.danger,
  'Due soon': colors.warn,
  OK: colors.good,
  'No record': colors.muted,
};

export function Button({
  label,
  onPress,
  color = colors.primary,
  variant = 'solid',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        solid ? { backgroundColor: color } : { borderColor: color, borderWidth: 1.5 },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: solid ? colors.primaryText : color }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** A small colored label: Overdue / Due soon / OK / No record. */
export function StatusPill({ status }: { status: Status }) {
  const c = statusColor[status];
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <Text style={[styles.pillText, { color: c }]}>{status}</Text>
    </View>
  );
}

/** Tap-to-pick option. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secure,
  caps,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  secure?: boolean;
  caps?: boolean; // all capitals, no autocorrect (VINs, part numbers)
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secure}
        autoCapitalize={caps ? 'characters' : secure || keyboardType === 'url' ? 'none' : 'sentences'}
        autoCorrect={!caps && !secure && keyboardType !== 'url'}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'warn' | 'good' | 'info'; children: ReactNode }) {
  const c = tone === 'warn' ? colors.danger : tone === 'good' ? colors.good : colors.primary;
  return <View style={[styles.banner, { borderLeftColor: c }]}>{children}</View>;
}

export const text = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', color: colors.text },
  h2: { fontSize: 19, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
});

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 13, fontWeight: '700' },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  banner: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: 14,
    gap: 8,
  },
});

/**
 * A scrolling screen with text fields: the screen shrinks above the keyboard (Android apps are
 * edge-to-edge, so the window doesn't resize by itself) and the field being typed in stays visible.
 */
export function FormScroll({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

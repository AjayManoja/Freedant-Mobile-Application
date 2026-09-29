import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '@/api/network';
import { appMaxWidth, colors, fonts, minTouch, radius, shadow, space } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- text

const variants = {
  display: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 34, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
  heading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.ink },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.slateStrong },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.slateStrong },
} satisfies Record<string, TextStyle>;

export function AppText({
  variant = 'body',
  style,
  color,
  ...rest
}: TextProps & { variant?: keyof typeof variants; color?: string }) {
  // allowFontScaling stays on: layouts must hold at 200 % system font size (NFR-UX-05).
  return <Text {...rest} style={[variants[variant], color ? { color } : null, style]} />;
}

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  const offline = useNetwork((s) => s.offline);
  const { t } = useTranslation();
  const body = <View style={[styles.column, padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {offline ? (
        <View style={styles.offline} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
          <AppText variant="caption" color={colors.warning}>
            {t('common.offline')}
          </AppText>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.iconButton}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      ) : null}
      <AppText variant="title" style={styles.flex} accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  label,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  label?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={12}>
          <AppText variant="label" color={colors.teal}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[styles.row, style]}>{children}</View>
);

// ---------------------------------------------------------------- controls

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}) {
  const fg =
    kind === 'primary' || kind === 'danger' ? colors.white : kind === 'secondary' ? colors.teal : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${kind}`],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={fg} />
      ) : null}
      <AppText variant="bodyStrong" color={fg}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
      {badge ? (
        <View style={styles.badgeDot}>
          <AppText variant="label" color={colors.white} style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.white : colors.teal} /> : null}
      <AppText variant="label" color={selected ? colors.white : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.slate}
        style={[
          styles.input,
          error ? styles.inputError : null,
          input.multiline && styles.inputMultiline,
          input.style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          style={[styles.segment, o.value === value && styles.segmentActive]}
        >
          <AppText variant="bodyStrong" color={o.value === value ? colors.teal : colors.slateStrong}>
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- feedback

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
const toneColors: Record<Tone, [string, string]> = {
  neutral: [colors.canvas, colors.slateStrong],
  success: [colors.successTint, colors.success],
  warning: [colors.warningTint, colors.warning],
  danger: [colors.dangerTint, colors.danger],
  brand: [colors.mint, colors.teal],
};

/** State is never colour alone (NFR-UX-03): every badge has text and an icon. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const [bg, fg] = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function Notice({ tone, icon, text }: { tone: Tone; icon: IconName; text: string }) {
  const [bg, fg] = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={fg} />
      <AppText variant="bodyStrong" color={fg} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityLabel={t('common.loading')}>
      <ActivityIndicator color={colors.teal} size="large" />
    </View>
  );
}

export function EmptyState({
  icon,
  text,
  action,
  onAction,
}: {
  icon: IconName;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.teal} />
      </View>
      <AppText variant="body" style={styles.centerText}>
        {text}
      </AppText>
      {action && onAction ? <Button title={action} onPress={onAction} kind="secondary" /> : null}
    </View>
  );
}

export function ErrorState({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerTint }]}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <AppText variant="bodyStrong" style={styles.centerText}>
        {message}
      </AppText>
      {requestId ? <AppText variant="caption">{t('common.requestId', { id: requestId })}</AppText> : null}
      {onRetry ? <Button title={t('common.retry')} onPress={onRetry} kind="secondary" /> : null}
    </View>
  );
}

export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri: string | null | undefined;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };
  // Own storage plus a fallback, so a missing image never leaves a hole (PROJECT_PLAN).
  return uri ? (
    <Image source={{ uri }} style={box} accessibilityLabel={name} contentFit="cover" />
  ) : (
    <View style={[box, styles.avatarFallback]} accessibilityLabel={name}>
      <AppText variant="label" color={colors.teal}>
        {initials}
      </AppText>
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={t('common.close')} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {title ? (
          <AppText variant="title" accessibilityRole="header" style={styles.sheetTitle}>
            {title}
          </AppText>
        ) : null}
        {children}
      </SafeAreaView>
    </Modal>
  );
}

/** Alert.alert has no buttons on web, so destructive confirmations use a sheet everywhere. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirm,
  onConfirm,
  onClose,
  busy,
  danger,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <AppText variant="body">{message}</AppText>
      <Button title={confirm} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={busy} />
      <Button title={t('common.cancel')} kind="ghost" onPress={onClose} disabled={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.canvas },
  column: { width: '100%', maxWidth: appMaxWidth, alignSelf: 'center', gap: space.lg },
  padded: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  scrollContent: { flexGrow: 1 },
  footer: {
    width: '100%',
    maxWidth: appMaxWidth,
    alignSelf: 'center',
    padding: space.lg,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  offline: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
    backgroundColor: colors.warningTint,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: minTouch },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    ...shadow,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    minHeight: minTouch + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: { backgroundColor: colors.teal },
  button_secondary: { backgroundColor: colors.mint },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  button_danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  field: { gap: space.xs },
  input: {
    minHeight: minTouch + 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 110, paddingTop: space.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  segmented: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.md, padding: 4 },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.mint },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.mint, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal },
  center: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: { backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
    width: '100%',
    maxWidth: appMaxWidth,
    alignSelf: 'center',
    maxHeight: '90%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: space.sm,
  },
  sheetTitle: { marginTop: space.xs },
});

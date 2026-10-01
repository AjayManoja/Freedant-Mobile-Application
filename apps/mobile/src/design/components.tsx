import type { CompetitionSummary } from '@feedants/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deadlineFor, useNow } from '@/components/competition';
import { formatDuration, formatInr } from '@/lib/format';
import { Gradient } from './gradient';
import { ArrowLeft, CheckCircle, Chevron, Clock, Users } from './icons';
import { T } from './text';
import tw, { color, ring } from './tw';

/** Money as the design shows it: "₹ 1,500". */
export const inr = (paise: number) => formatInr(paise).replace('₹', '₹ ');

/** `active:scale-[0.99] transition` */
export function Press({
  style,
  scale = 0.99,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  scale?: number;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }] }]}
    >
      {children}
    </Pressable>
  );
}

/** ui.tsx Card: `rounded-2xl bg-white p-5 shadow-sm`. */
export const Card = ({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) => (
  <View style={[tw`rounded-2xl bg-white p-5 shadow-sm`, style]}>{children}</View>
);

/** ui.tsx SectionHeader. */
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
    <View style={tw`flex-row items-center justify-between mb-3`}>
      <T style={tw`font-bold text-ink`} accessibilityRole="header">
        {title}
      </T>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          hitSlop={8}
          style={tw`flex-row items-center gap-0.5`}
        >
          <T style={tw`text-teal text-xs font-semibold`}>{action}</T>
          <Chevron size={14} color={color('teal')} rotate={-90} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** ui.tsx PageHeader: the back header of secondary pages. */
export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={tw`bg-canvas px-4 pt-4 pb-3 flex-row items-center gap-3`}>
      <Press
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        accessibilityLabel={t('common.back')}
        scale={0.95}
        style={tw`w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center`}
      >
        <ArrowLeft color={color('ink')} />
      </Press>
      <View style={tw`min-w-0 flex-1`}>
        {subtitle ? (
          <T style={tw`text-slate text-xs`} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        <T
          style={tw`text-2xl font-extrabold text-ink leading-tight`}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </T>
      </View>
      {right}
    </View>
  );
}

/** The phase deadline as the design shows it: "1d : 06h", "09h : 22m". */
export function useCountdownLabel(c: Parameters<typeof deadlineFor>[0]): string | null {
  const now = useNow();
  const { t } = useTranslation();
  const d = deadlineFor(c);
  return d?.at ? formatDuration(new Date(d.at).getTime() - now, t) : null;
}

/** components/CompetitionRow.tsx (the star rating is left out: there are no ratings). */
export function CompetitionRow({ c }: { c: CompetitionSummary }) {
  const router = useRouter();
  const { t } = useTranslation();
  const ends = useCountdownLabel(c);
  return (
    <Press
      onPress={() => router.push(`/competition/${c.id}`)}
      accessibilityLabel={c.title}
      style={tw`w-full`}
      scale={1}
    >
      {/* Card p-5 wins over the row's p-3 in the design's stylesheet (measured: 20px). */}
      <Card style={tw`flex-row items-center gap-3`}>
        <CoverImage uri={c.coverUrl} style={tw`w-16 h-16 rounded-xl`} />
        <View style={tw`flex-1 min-w-0`}>
          <T style={tw`font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
            {c.title}
          </T>
          <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
            {[c.category?.name, c.host.displayName].filter(Boolean).join(' · ')}
          </T>
          <View style={tw`flex-row items-center gap-3 mt-1.5`}>
            {ends ? (
              <View style={tw`flex-row items-center gap-1`}>
                <Clock color={color('teal')} />
                <T style={tw`text-[11px] text-teal font-semibold`}>{ends}</T>
              </View>
            ) : null}
            <View style={tw`flex-row items-center gap-1`}>
              <Users color={color('slate')} />
              <T style={tw`text-[11px] text-slate`}>{c.participants}</T>
            </View>
          </View>
        </View>
        <View style={tw`items-end shrink-0`}>
          <T style={tw`text-[10px] text-slate`}>{t('design.prize')}</T>
          <T style={tw`text-teal font-extrabold`}>{inr(c.prizePoolPaise)}</T>
          <T style={tw`text-[10px] text-slate mt-1`}>
            {t('design.entry')} {c.entryFeePaise === 0 ? t('common.free') : inr(c.entryFeePaise)}
          </T>
        </View>
      </Card>
    </Press>
  );
}

/** HomePage ExpandToggle: "Show N more" / "Show less". */
export function ExpandToggle({
  expanded,
  hidden,
  onToggle,
}: {
  expanded: boolean;
  hidden: number;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  if (!expanded && hidden <= 0) return null;
  return (
    <Press
      onPress={onToggle}
      style={[
        tw`mt-3 w-full flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5`,
        { borderColor: 'rgba(13,128,116,0.2)', backgroundColor: 'rgba(232,245,241,0.6)' },
      ]}
    >
      <T style={tw`text-xs font-semibold text-teal`}>
        {expanded ? t('design.showLess') : t('design.showMore', { count: hidden })}
      </T>
      <Chevron size={16} color={color('teal')} rotate={expanded ? 180 : 0} />
    </Press>
  );
}

/** Image with the design's `bg-mint` placeholder, so layout never jumps while loading. */
export function CoverImage({ uri, style }: { uri: string | null; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[tw`bg-mint overflow-hidden`, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={tw`absolute inset-0`}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const ORB_TINTS: [string, string][] = [
  ['#0d8074', '#0a6b60'],
  ['#7c86ff', '#4f39f6'],
  ['#ff637e', '#ec003f'],
  ['#ffb900', '#ff6900'],
  ['#ed6aff', '#9810fa'],
];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

/** HomePage ORB_TINTS: initials on a gradient circle. */
export function Orb({
  name,
  index,
  size,
  textStyle,
  style,
}: {
  name: string;
  index: number;
  size: number;
  textStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Gradient
      dir="br"
      colors={ORB_TINTS[index % ORB_TINTS.length]!}
      style={[{ width: size, height: size, borderRadius: size / 2 }, tw`items-center justify-center`, style]}
    >
      <T style={[tw`text-xs font-extrabold text-white`, textStyle as never]}>{initials(name)}</T>
    </Gradient>
  );
}

/** A person's photo, or their initials orb when they have none. */
export function PersonAvatar({
  uri,
  name,
  index,
  size,
  style,
}: {
  uri: string | null | undefined;
  name: string;
  index: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, tw`bg-mint`, style as never]}
        contentFit="cover"
        accessibilityLabel={name}
      />
    );
  }
  return (
    <Orb
      name={name}
      index={index}
      size={size}
      style={style}
      textStyle={size >= 44 ? tw`text-sm` : undefined}
    />
  );
}

/** Bottom sheet: `rounded-t-3xl px-5 pb-8 pt-3 shadow-2xl` over `bg-ink/50`, with the grabber. */
export function BottomSheet({
  open,
  onClose,
  children,
  tone = 'canvas',
  bare,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  tone?: 'canvas' | 'white';
  /** No grabber or padding: the content draws its own chrome (the checkout gateway). */
  bare?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end items-center`}>
        <Pressable
          style={[tw`absolute inset-0`, { backgroundColor: 'rgba(27,43,58,0.5)' }]}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            tw`w-full max-w-[430px] rounded-t-3xl shadow-2xl`,
            tone === 'white' ? tw`bg-white` : tw`bg-canvas`,
            bare ? tw`overflow-hidden` : [tw`px-5 pt-3`, { paddingBottom: Math.max(32, insets.bottom + 16) }],
            { maxHeight: '92%' },
          ]}
        >
          {bare ? null : (
            <View
              style={[tw`self-center h-1 w-10 rounded-full`, { backgroundColor: 'rgba(27,43,58,0.15)' }]}
            />
          )}
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Primary / secondary buttons used by the sheets: `rounded-xl py-3 text-sm font-bold`. */
export function SheetButton({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'mint';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        tw`rounded-xl py-3.5 items-center justify-center flex-row gap-2`,
        kind === 'primary' ? tw`bg-teal shadow-sm` : tw`bg-mint`,
        (disabled || loading) && tw`opacity-50`,
        style,
      ]}
    >
      {loading ? <Spinner /> : null}
      <T style={tw`text-sm font-bold ${kind === 'primary' ? 'text-white' : 'text-teal'}`}>{title}</T>
    </Press>
  );
}

/** `h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin` */
export function Spinner({ light = true }: { light?: boolean }) {
  return <ActivityIndicator size="small" color={light ? '#ffffff' : color('teal')} />;
}

/**
 * The dashboard pages' header (My Submissions, My Competitions, Wallet): a bare back arrow
 * (`w-9 h-9 -ml-1`), an optional caption over a `text-xl` title, and an optional action.
 */
export function BackHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={tw`flex-row items-center justify-between px-5 pt-4 pb-2`}>
      <View style={tw`flex-row items-center gap-2 min-w-0 flex-1`}>
        <Press
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          accessibilityLabel={t('common.back')}
          scale={0.95}
          style={tw`w-9 h-9 -ml-1 rounded-full items-center justify-center`}
        >
          <ArrowLeft color={color('ink')} />
        </Press>
        <View style={tw`min-w-0 flex-1`}>
          {subtitle ? (
            <T style={tw`text-slate text-xs`} numberOfLines={1}>
              {subtitle}
            </T>
          ) : null}
          <T
            style={tw`text-xl font-extrabold text-ink leading-tight`}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </T>
        </View>
      </View>
      {right}
    </View>
  );
}

/** Filter chips with counts: `rounded-full px-3.5 py-2 text-xs font-semibold`, scrolling sideways. */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
  tone = 'teal',
  style,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  /** The active chip: `bg-teal` (submissions) or `bg-ink` (host dashboard). */
  tone?: 'teal' | 'ink';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[tw`-mx-1`, style]}
      contentContainerStyle={tw`gap-2 px-1`}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              tw`shrink-0 flex-row rounded-full px-3.5 py-2`,
              active
                ? [tw`shadow-sm`, tone === 'teal' ? tw`bg-teal` : tw`bg-ink`]
                : [tw`bg-white`, ring(1, color('neutral-200'))],
            ]}
          >
            <T style={tw`text-xs font-semibold ${active ? 'text-white' : 'text-slate'}`}>{o.label}</T>
            {o.count !== undefined ? (
              <T
                style={[
                  tw`ml-1.5 text-xs font-semibold`,
                  {
                    color: active
                      ? `rgba(255,255,255,${tone === 'teal' ? 0.8 : 0.7})`
                      : 'rgba(107,125,140,0.7)',
                  },
                ]}
              >
                {o.count}
              </T>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Status pill on list rows: `rounded-full px-2.5 py-0.5 text-[10px] font-semibold`. */
export function StatusPill({ label, tint }: { label: string; tint: string }) {
  const [bg, fg] = tint.split(' ');
  return (
    <View style={tw`shrink-0 rounded-full px-2.5 py-0.5 ${bg ?? ''}`}>
      <T style={tw`text-[10px] font-semibold ${fg ?? ''}`}>{label}</T>
    </View>
  );
}

/** A transient confirmation, `bottom-24` over the content; it hides itself after 2 s. */
export function useToast(): [ReactNode, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(id);
  }, [message]);
  const node = message ? (
    <View
      style={[tw`absolute left-0 right-0 bottom-24 items-center z-50`, { pointerEvents: 'none' }]}
      accessibilityLiveRegion="polite"
    >
      <View style={tw`flex-row items-center gap-2 rounded-full bg-ink px-4 py-2.5 shadow-lg`}>
        <CheckCircle color="#46ecd5" />
        <T style={tw`text-sm font-semibold text-white`}>{message}</T>
      </View>
    </View>
  ) : null;
  return [node, setMessage];
}

/** Centred confirm dialog: `max-w-[300px] rounded-3xl bg-white p-6 text-center shadow-2xl`. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirm,
  cancel,
  busy,
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirm: string;
  cancel: string;
  busy?: boolean;
  /** `bg-rose-500` for destructive actions, `bg-teal` for final-but-wanted ones (publishing results). */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <Pressable
          style={[tw`absolute inset-0`, { backgroundColor: 'rgba(27,43,58,0.5)' }]}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={tw`w-full max-w-[300px] rounded-3xl bg-white p-6 shadow-2xl`} accessibilityViewIsModal>
          <T style={tw`text-lg font-extrabold text-ink text-center`} accessibilityRole="header">
            {title}
          </T>
          <T style={tw`mt-1 text-sm text-slate text-center`}>{message}</T>
          <View style={tw`mt-5 flex-row gap-3`}>
            <Press
              onPress={onClose}
              disabled={busy}
              style={tw`flex-1 rounded-xl bg-neutral-100 py-3 items-center`}
            >
              <T style={tw`text-sm font-bold text-ink`}>{cancel}</T>
            </Press>
            <Press
              onPress={onConfirm}
              disabled={busy}
              accessibilityState={{ busy: !!busy }}
              style={[
                tw`flex-1 rounded-xl py-3 items-center justify-center flex-row gap-2 ${tone === 'danger' ? 'bg-rose-500' : 'bg-teal'}`,
                busy && tw`opacity-60`,
              ]}
            >
              {busy ? <Spinner /> : null}
              <T style={tw`text-sm font-bold text-white`}>{confirm}</T>
            </Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** HostPage Field: `text-xs font-semibold` label, an optional `text-[11px]` hint, then the control. */
export function FormField({
  label,
  hint,
  error,
  children,
  style,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={tw`flex-row items-baseline h-6 pt-1`}>
        <T style={tw`text-xs font-semibold text-ink`}>{label}</T>
        {hint ? <T style={tw`text-[11px] text-slate ml-1.5`}>{hint}</T> : null}
      </View>
      <View style={tw`mt-1.5`}>{children}</View>
      {error ? (
        <T style={tw`mt-1.5 text-[11px] text-rose-500`} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
    </View>
  );
}

/**
 * HostPage inputCls: `rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm`,
 * `focus:ring-2 focus:ring-teal`, with an optional icon pinned to the right.
 */
export function Input({
  icon,
  style,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { icon?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <TextInput
        placeholderTextColor="rgba(107,125,140,0.7)"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        style={[
          tw`w-full rounded-xl bg-white px-3.5 py-3 text-sm text-ink`,
          { fontFamily: 'Poppins_400Regular', lineHeight: 20 },
          focused ? ring(2, color('teal')) : ring(1, color('neutral-200')),
          icon ? tw`pr-10` : null,
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          style,
        ]}
      />
      {icon ? (
        <View style={[tw`absolute right-3.5 top-0 bottom-0 justify-center`, { pointerEvents: 'none' }]}>
          {icon}
        </View>
      ) : null}
    </View>
  );
}

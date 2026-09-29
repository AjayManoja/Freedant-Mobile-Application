import type { CompetitionSummary, DisplayPhase, SubmissionDisplayStatus } from '@feedants/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatDuration, formatInr } from '@/lib/format';
import { colors, radius, shadow, space } from '@/theme/tokens';
import { AppText, Badge, type IconName, type Tone } from './ui';

// ---------------------------------------------------------------- clock (A-15)

let clockOffsetMs = 0;
/** Corrects countdowns for a wrong device clock, from the server time on each detail load. */
export const syncServerClock = (serverTimeIso: string) => {
  clockOffsetMs = new Date(serverTimeIso).getTime() - Date.now();
};
export const serverNow = () => Date.now() + clockOffsetMs;

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** The deadline that matters to a visitor in each phase. */
export function deadlineFor(
  c: Pick<CompetitionSummary, 'phase' | 'registrationOpensAt' | 'registrationClosesAt' | 'submissionEndsAt'>,
) {
  switch (c.phase) {
    case 'UPCOMING':
      return { key: 'countdown.opensIn', at: c.registrationOpensAt };
    case 'OPEN':
      return { key: 'countdown.closesIn', at: c.registrationClosesAt };
    case 'SUBMISSIONS':
      return { key: 'countdown.submitIn', at: c.submissionEndsAt };
    default:
      return null;
  }
}

export function Countdown({
  competition,
  tone = 'dark',
}: {
  competition: CompetitionSummary;
  tone?: 'dark' | 'light';
}) {
  const { t } = useTranslation();
  const now = useNow(competition.phase === 'OPEN' ? 1000 : 30_000);
  const d = deadlineFor(competition);
  if (!d?.at) return null;
  const color = tone === 'light' ? colors.white : colors.slateStrong;
  return (
    <View style={styles.inline}>
      <Ionicons name="time-outline" size={13} color={color} />
      <AppText variant="caption" color={color}>
        {t(d.key, { time: formatDuration(new Date(d.at).getTime() - now, t) })}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------- phase badge

const phaseStyle: Record<DisplayPhase, { tone: Tone; icon: IconName }> = {
  DRAFT: { tone: 'neutral', icon: 'create-outline' },
  AWAITING_FUNDING: { tone: 'warning', icon: 'hourglass-outline' },
  UPCOMING: { tone: 'neutral', icon: 'calendar-outline' },
  OPEN: { tone: 'success', icon: 'radio-button-on' },
  SUBMISSIONS: { tone: 'brand', icon: 'cloud-upload-outline' },
  JUDGING: { tone: 'warning', icon: 'ribbon-outline' },
  COMPLETED: { tone: 'brand', icon: 'trophy-outline' },
  CANCELLED: { tone: 'danger', icon: 'close-circle-outline' },
};

export function PhaseBadge({ phase }: { phase: DisplayPhase }) {
  const { t } = useTranslation();
  const s = phaseStyle[phase];
  return <Badge label={t(`phase.${phase}`)} tone={s.tone} icon={s.icon} />;
}

const submissionStyle: Record<SubmissionDisplayStatus, { tone: Tone; icon: IconName }> = {
  DRAFT: { tone: 'neutral', icon: 'create-outline' },
  IN_REVIEW: { tone: 'warning', icon: 'hourglass-outline' },
  WON: { tone: 'success', icon: 'trophy' },
  NOT_SELECTED: { tone: 'neutral', icon: 'remove-circle-outline' },
};

/** FR-SB-05: Draft / In review / Won / Not selected. */
export function SubmissionBadge({ status }: { status: SubmissionDisplayStatus }) {
  const { t } = useTranslation();
  const s = submissionStyle[status];
  return <Badge label={t(`competitions.status.${status}`)} tone={s.tone} icon={s.icon} />;
}

// ---------------------------------------------------------------- cards

export function CompetitionRow({ c }: { c: CompetitionSummary }) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => router.push(`/competition/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${c.title}, ${t('detail.prizePool')} ${formatInr(c.prizePoolPaise)}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Cover uri={c.coverUrl} size={72} />
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {c.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {[c.category?.name, c.host.displayName].filter(Boolean).join(' · ')}
        </AppText>
        <Countdown competition={c} />
        <View style={styles.inline}>
          <Ionicons name="people-outline" size={13} color={colors.slateStrong} />
          <AppText variant="caption">{t('common.participants', { count: c.participants })}</AppText>
        </View>
      </View>
      <View style={styles.prize}>
        <AppText variant="caption">{t('detail.prizePool')}</AppText>
        <AppText variant="heading" color={colors.teal}>
          {formatInr(c.prizePoolPaise)}
        </AppText>
        <AppText variant="caption">
          {c.entryFeePaise === 0 ? t('common.free') : `${t('detail.entryFee')} ${formatInr(c.entryFeePaise)}`}
        </AppText>
      </View>
    </Pressable>
  );
}

export function FeaturedCard({ c }: { c: CompetitionSummary }) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => router.push(`/competition/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.featured')}: ${c.title}`}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
    >
      {c.coverUrl ? (
        <Image source={{ uri: c.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.featuredShade} />
      <View style={styles.featuredTop}>
        <Badge label={t('home.featured')} tone="brand" icon="flame-outline" />
      </View>
      <AppText variant="display" color={colors.white} numberOfLines={2}>
        {c.title}
      </AppText>
      <View style={styles.featuredBottom}>
        <View style={styles.pill}>
          <Ionicons name="trophy-outline" size={14} color={colors.white} />
          <AppText variant="bodyStrong" color={colors.white}>
            {formatInr(c.prizePoolPaise)}
          </AppText>
        </View>
        <View style={styles.pill}>
          <Countdown competition={c} tone="light" />
        </View>
      </View>
    </Pressable>
  );
}

export function Cover({ uri, size }: { uri: string | null; size: number }) {
  const box = { width: size, height: size, borderRadius: radius.md };
  // Background colour held while loading, so layout never jumps (NFR-6 of the prototype).
  return uri ? (
    <Image
      source={{ uri }}
      style={[box, styles.coverBg]}
      contentFit="cover"
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={[box, styles.coverBg, styles.coverFallback]}>
      <Ionicons name="trophy" size={size / 2.5} color={colors.teal} />
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
    ...shadow,
  },
  pressed: { opacity: 0.88 },
  rowBody: { flex: 1, gap: 2 },
  prize: { alignItems: 'flex-end', gap: 2 },
  featured: {
    height: 200,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.tealDark,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  featuredShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(10, 107, 96, 0.55)',
  },
  featuredTop: { flexDirection: 'row' },
  featuredBottom: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  coverBg: { backgroundColor: colors.mint },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
});

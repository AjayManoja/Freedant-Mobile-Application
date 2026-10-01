import {
  type CheckoutDetails,
  type CompetitionDetail,
  feeBreakdown,
  type RegistrationView,
} from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ApiError, newIdempotencyKey } from '@/api/client';
import { getRegistration, join, useCompetition, useLeaderboard, useNotify } from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import { syncServerClock, useNow } from '@/components/competition';
import { Loading } from '@/design/loading';
import { BottomNav } from '@/design/bottom-nav';
import { BottomSheet, Card, CoverImage, inr, PersonAvatar, Press, Spinner } from '@/design/components';
import { EmptyState, NoResultsArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle,
  Chevron,
  Clock,
  Hourglass,
  Info,
  PathIcon,
  Send,
  Shield,
  Trophy,
  Upload,
  Users,
} from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage } from '@/lib/format';
import { isFakeCheckout, openRazorpayCheckout, simulateFakePayment } from '@/payments/checkout';

const WALLET = 'M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7l2-3h11M17 13h.01';

/** US-11, US-19…23 — design/prototype/src/pages/CompetitionsPage.tsx. */
export default function CompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const q = useCompetition(id);

  useEffect(() => {
    if (q.data) syncServerClock(q.data.serverTime);
  }, [q.data]);

  if (q.isPending) return <Loading />;
  if (q.isError) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <SafeAreaView style={tw`flex-1 bg-canvas items-center justify-center`}>
        <EmptyState
          illustration={<NoResultsArt />}
          title={notFound ? t('detail.notFound') : t('common.somethingWrong')}
          message={notFound ? t('design.notFoundBody') : errorMessage(q.error, t)}
          primary={
            notFound
              ? { label: t('design.exploreCompetitions'), onPress: () => router.replace('/explore') }
              : { label: t('common.retry'), onPress: () => void q.refetch() }
          }
        />
      </SafeAreaView>
    );
  }
  return <Detail c={q.data} />;
}

function Detail({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<RegistrationView | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // One key per join attempt: a retry after a timeout replays the same request (FR-PT-07).
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const refresh = () => {
    for (const key of ['competition', 'home', 'my-submissions'])
      void qc.invalidateQueries({ queryKey: [key] });
  };

  /** Register: a free competition confirms at once; a paid one holds a spot and opens checkout. */
  const register = async () => {
    if (!requireSignIn(`/competition/${c.id}`)) return;
    const held = c.viewer?.registration;
    if (held?.status === 'HELD' && held.checkout) return setCheckout(held);
    setJoining(true);
    setJoinError(null);
    keyRef.current ??= newIdempotencyKey();
    try {
      const { registration: r } = await join(c.id, keyRef.current);
      if (r.status === 'CONFIRMED') {
        keyRef.current = null;
        refresh();
        setToast(t('design.registeredFor', { title: c.title }));
      } else if (r.status === 'HELD' && r.checkout) {
        setCheckout(r);
      }
    } catch (e) {
      // Only a definitive answer ends this attempt; a network failure keeps the key for retry.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) keyRef.current = null;
      setJoinError(errorMessage(e, t));
      refresh();
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <ScrollView contentContainerStyle={tw`pb-44`} showsVerticalScrollIndicator={false}>
          <Hero c={c} />
          <View style={tw`px-4 -mt-6 gap-4`}>
            <InfoCard c={c} />
            {joinError ? (
              <View
                style={tw`flex-row items-start gap-2 rounded-2xl bg-red-50 px-4 py-3`}
                accessibilityRole="alert"
              >
                <Info color={color('red-500')} />
                <T style={tw`flex-1 text-sm text-ink`}>{joinError}</T>
              </View>
            ) : null}
            <JudgeCard c={c} />
            <CountdownStrip c={c} />
            <DatesCard c={c} />
            {c.phase === 'COMPLETED' ? <WinnersCard c={c} /> : null}
            <TabsCard c={c} />
            {c.prizeTiers.length > 0 ? <RewardsCard c={c} /> : null}
            <View style={tw`flex-row items-start gap-2 rounded-2xl bg-mint px-4 py-3`}>
              <View style={tw`mt-0.5`}>
                <Info color={color('teal')} />
              </View>
              <T style={tw`flex-1 text-sm text-slate`}>
                <T style={tw`font-bold text-ink`}>{t('design.disclaimer')}</T> {t('design.disclaimerBody')}
              </T>
            </View>
            <PrizeInfoCard />
          </View>
        </ScrollView>

        <StickyCta c={c} busy={joining} onRegister={() => void register()} />
        {toast ? (
          <View style={[tw`absolute left-0 right-0 bottom-40 items-center z-50`, { pointerEvents: 'none' }]}>
            <View style={tw`flex-row items-center gap-2 rounded-full bg-ink px-4 py-2.5 shadow-lg`}>
              <CheckCircle color="#46ecd5" />
              <T style={tw`text-sm font-semibold text-white`}>{toast}</T>
            </View>
          </View>
        ) : null}
      </View>
      <BottomNav active="competitions" />
      {checkout ? (
        <CheckoutSheet
          c={c}
          registration={checkout}
          onClose={() => {
            setCheckout(null);
            refresh();
          }}
          onPaid={() => {
            keyRef.current = null;
            setCheckout(null);
            refresh();
            setToast(t('design.paidFor', { title: c.title }));
          }}
          onEnded={() => {
            keyRef.current = null;
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- hero + info

function Hero({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={tw`h-44`}>
      <CoverImage uri={c.coverUrl} style={tw`absolute inset-0`} />
      <Gradient
        dir="b"
        colors={['rgba(27,43,58,0.8)', 'rgba(27,43,58,0.35)', color('canvas')]}
        style={tw`absolute inset-0`}
      />
      {/* h-14 = pt-4 + the 40px row the design's language toggle sets (the toggle itself is out of scope). */}
      <View style={tw`flex-row items-center justify-between px-5 pt-4 h-14`}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel={t('design.goBack')}
          style={tw`flex-row items-center gap-2`}
        >
          <ArrowLeft color="#fff" />
          <T
            style={[
              tw`text-white font-bold text-lg`,
              {
                textShadowColor: 'rgba(0,0,0,0.1)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              },
            ]}
          >
            {t('design.goBack')}
          </T>
        </Pressable>
      </View>
      {c.category ? (
        <View style={tw`px-5 mt-4`}>
          <View style={tw`self-start flex-row items-center gap-1 rounded-full bg-white/20 px-2.5 py-1`}>
            <Trophy size={14} color="#fff" />
            <T style={tw`text-[11px] font-semibold text-white`}>
              {t('design.categoryCompetition', { name: c.category.name })}
            </T>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const Pill = ({ children }: { children: ReactNode }) => (
  <View style={tw`rounded-md bg-neutral-100 px-2.5 py-1`}>
    <T style={tw`text-slate text-xs font-medium`}>{children}</T>
  </View>
);

function InfoCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const registered = c.viewer?.registration?.status === 'CONFIRMED';
  const joined = c.participants;
  const pct = Math.min(95, Math.round((joined / Math.max(1, joined + c.spotsRemaining)) * 100));
  return (
    <Card>
      <View style={tw`flex-row items-start justify-between gap-3`}>
        <T style={tw`flex-1 text-[26px] leading-tight font-extrabold text-ink`} accessibilityRole="header">
          {c.title}
        </T>
        {registered ? (
          <View style={tw`flex-row items-center gap-1.5 rounded-full bg-mint px-3 py-1.5`}>
            <CheckCircle color={color('teal-dark')} />
            <T style={tw`text-teal-dark text-xs font-semibold`}>{t('design.registeredBadge')}</T>
          </View>
        ) : null}
      </View>
      <View style={tw`mt-3 flex-row items-center gap-2 flex-wrap`}>
        {c.category ? <Pill>{c.category.name}</Pill> : null}
        {c.prizeTiers.length > 1 ? <Pill>{t('design.multiWin')}</Pill> : null}
        {c.status === 'CANCELLED' ? <Pill>{t('phase.CANCELLED')}</Pill> : null}
      </View>
      <View style={tw`mt-5 flex-row items-end justify-between gap-4`}>
        <View style={tw`flex-row items-end gap-6`}>
          <View>
            <T style={tw`text-slate text-sm`}>{t('design.prizePool')}</T>
            <T style={tw`text-2xl font-extrabold text-teal mt-1`}>{inr(c.prizePoolPaise)}</T>
          </View>
          <View>
            <T style={tw`text-slate text-sm`}>{t('design.entryFee')}</T>
            <T style={tw`text-2xl font-extrabold text-ink mt-1`}>
              {c.entryFeePaise === 0 ? t('common.free') : inr(c.entryFeePaise)}
            </T>
          </View>
        </View>
        <View style={tw`flex-1 max-w-[150px]`}>
          <View style={tw`flex-row items-center justify-end gap-1.5`}>
            <Users color={color('teal')} />
            <T style={tw`text-teal text-sm font-semibold`}>
              {t('design.spotsLeft', { count: c.spotsRemaining })}
            </T>
          </View>
          <View style={tw`mt-2 h-1.5 rounded-full bg-neutral-200 overflow-hidden`}>
            <View style={[tw`h-full rounded-full bg-teal`, { width: `${pct}%` }]} />
          </View>
          <T style={tw`text-right text-xs text-slate mt-1`}>{t('design.joinedCount', { count: joined })}</T>
        </View>
      </View>
    </Card>
  );
}

function JudgeCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  return (
    <Card style={tw`flex-row items-center gap-4`}>
      <PersonAvatar uri={c.host.avatarUrl} name={c.host.displayName} index={1} size={64} />
      <View style={tw`flex-1`}>
        <T style={tw`text-slate text-xs`}>{t('design.judge')}</T>
        <T style={tw`text-lg font-bold text-ink leading-snug`}>{c.host.displayName}</T>
        <T style={tw`text-slate text-xs`}>{t('design.hostJudges')}</T>
        <T style={tw`text-slate text-xs`}>{t('design.judgeScale')}</T>
      </View>
    </Card>
  );
}

/** "Registration closes in 01d : 05h : 59m" — the deadline of the current phase. */
function CountdownStrip({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const target =
    c.phase === 'UPCOMING'
      ? c.registrationOpensAt
      : c.phase === 'OPEN'
        ? c.registrationClosesAt
        : c.phase === 'SUBMISSIONS'
          ? c.submissionEndsAt
          : null;
  if (!target || c.status === 'CANCELLED') return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const p = (n: number) => String(n).padStart(2, '0');
  const value = `${p(Math.floor(diff / 86_400_000))}d : ${p(Math.floor((diff % 86_400_000) / 3_600_000))}h : ${p(Math.floor((diff % 3_600_000) / 60_000))}m`;
  return (
    <View style={tw`flex-row items-center justify-between gap-2 rounded-2xl bg-mint px-4 py-3`}>
      {/* Three flex items that each shrink and wrap, like the design's spans. */}
      <View style={tw`flex-row items-center gap-2 shrink`}>
        <Hourglass color={color('ink')} />
        <T style={tw`text-ink text-sm font-medium shrink`}>{t(`design.countdown.${c.phase}`)}</T>
      </View>
      <T style={[tw`text-teal font-bold text-sm shrink`, { fontVariant: ['tabular-nums'] }]}>{value}</T>
      {c.phase !== 'UPCOMING' ? (
        <View style={tw`flex-row items-center gap-1 shrink`}>
          <Clock color={color('teal')} />
          <T style={tw`text-teal text-sm font-medium shrink`}>{t('design.hurry')}</T>
        </View>
      ) : null}
    </View>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

function DatesCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const cells: { icon: ReactNode; label: string; at: string | null }[] = [
    {
      icon: <Calendar color={color('teal')} />,
      label: t('design.registerBefore'),
      at: c.registrationClosesAt,
    },
    { icon: <Send color={color('teal')} />, label: t('design.submissionStarts'), at: c.submissionStartsAt },
    { icon: <Upload color={color('teal')} />, label: t('design.submissionEnds'), at: c.submissionEndsAt },
    {
      icon: <Trophy size={20} color={color('teal')} />,
      label: t('design.resultDate'),
      at: c.resultsPublishedAt ?? c.resultsDueAt,
    },
  ];
  const border = [
    tw`border-b border-r border-neutral-100 pb-4 pr-4`,
    tw`border-b border-neutral-100 pb-4 pl-4`,
    tw`border-r border-neutral-100 pt-4 pr-4`,
    tw`pt-4 pl-4`,
  ];
  return (
    <Card>
      <T style={tw`font-bold text-ink mb-3`} accessibilityRole="header">
        {t('design.importantDates')}
      </T>
      <View style={tw`flex-row flex-wrap`}>
        {cells.map((d, i) => (
          <View key={d.label} style={[tw`w-1/2 flex-row items-start gap-3`, border[i]!]}>
            <View style={tw`mt-0.5`}>{d.icon}</View>
            <View style={tw`flex-1`}>
              <T style={tw`text-xs text-slate`}>{d.label}</T>
              <T style={tw`text-sm font-bold text-ink`}>{d.at ? dateFmt.format(new Date(d.at)) : '—'}</T>
              <T style={tw`text-xs text-slate`}>{d.at ? timeFmt.format(new Date(d.at)).toUpperCase() : ''}</T>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

/** "Previous Winners" becomes this competition's winners once results are published. */
function WinnersCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const router = useRouter();
  const lb = useLeaderboard(c.id);
  const winners = (lb.data?.entries ?? []).filter((e) => e.prizePaise > 0);
  if (winners.length === 0) return null;
  return (
    <Card>
      <View style={tw`flex-row items-center justify-between mb-3`}>
        <T style={tw`font-bold text-ink`}>{t('design.winners')}</T>
        <Pressable
          onPress={() => router.push(`/competition/${c.id}/leaderboard`)}
          accessibilityRole="link"
          style={tw`flex-row items-center gap-0.5`}
        >
          <T style={tw`text-teal text-xs font-semibold`}>{t('design.leaderboard')}</T>
          <Chevron size={14} color={color('teal')} rotate={-90} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={tw`-mx-1`}
        contentContainerStyle={tw`px-1 gap-3`}
      >
        {winners.map((w, i) => (
          <Press
            key={w.submissionId}
            onPress={() => router.push(`/winners/${w.creator.id}`)}
            accessibilityLabel={w.creator.displayName}
            scale={0.98}
            style={tw`w-[210px] flex-row items-center gap-2 rounded-xl bg-neutral-50 p-2`}
          >
            <View style={tw`w-14 h-14 rounded-lg overflow-hidden bg-mint`}>
              <PersonAvatar
                uri={w.creator.avatarUrl}
                name={w.creator.displayName}
                index={i}
                size={56}
                style={tw`rounded-lg`}
              />
            </View>
            <View style={tw`min-w-0 flex-1`}>
              <T style={tw`text-sm font-semibold text-ink leading-tight`} numberOfLines={1}>
                {w.creator.displayName}
              </T>
              <T style={tw`text-xs text-teal`}>{t('design.place', { place: ordinal(w.rank) })}</T>
              <T style={tw`text-xs text-slate`}>{t('design.won', { amount: inr(w.prizePaise) })}</T>
              <View style={tw`mt-0.5 flex-row items-center gap-0.5`}>
                <T style={tw`text-[11px] font-semibold text-teal`}>{t('design.viewProfile')}</T>
                <Chevron size={12} color={color('teal')} rotate={-90} />
              </View>
            </View>
          </Press>
        ))}
      </ScrollView>
    </Card>
  );
}

type TabKey = 'about' | 'judging' | 'rules';

function TabsCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('about');
  const [expanded, setExpanded] = useState(false);
  const content: Record<TabKey, string[]> = {
    about: (c.description ?? t('design.noDescription')).split(/\n+/).filter(Boolean),
    judging: t('design.judgingLines', { returnObjects: true }) as string[],
    rules: t('design.rulesLines', {
      returnObjects: true,
      entryFee: c.entryFeePaise === 0 ? t('common.free') : inr(c.fees.totalPaise),
    }) as string[],
  };
  const lines = expanded ? content[tab] : content[tab].slice(0, 3);
  return (
    <Card>
      <View style={tw`flex-row border-b border-neutral-100 -mx-5 px-5`} accessibilityRole="tablist">
        {(Object.keys(content) as TabKey[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={tw`flex-1 pb-3 items-center`}
          >
            <T style={tw`text-sm font-semibold text-center ${tab === key ? 'text-teal' : 'text-slate'}`}>
              {t(`design.tabs.${key}`)}
            </T>
            {tab === key ? (
              <View style={tw`absolute -bottom-px left-0 right-0 h-0.5 bg-teal rounded-full`} />
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={tw`pt-4 gap-1.5`}>
        {lines.map((line, i) => (
          <T key={i} style={tw`text-sm text-slate leading-relaxed`}>
            {line}
          </T>
        ))}
      </View>
      {content[tab].length > 3 ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          style={tw`mt-2 flex-row items-center gap-1 self-center`}
        >
          <T style={tw`text-teal text-sm font-semibold`}>
            {expanded ? t('design.viewLess') : t('design.viewMore')}
          </T>
          <Chevron color={color('teal')} rotate={expanded ? 180 : 0} />
        </Pressable>
      ) : null}
    </Card>
  );
}

function RewardIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={20} color={color('amber-500')} />;
  if (rank <= 3) {
    return (
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color('slate-400')}
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <Circle cx="12" cy="14" r="6" />
        <Path d="M8 3l2 6M16 3l-2 6" />
      </Svg>
    );
  }
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color('teal')}
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <Path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z" />
    </Svg>
  );
}

function RewardsCard({ c }: { c: CompetitionDetail }) {
  const { t } = useTranslation();
  return (
    <Card>
      <View style={tw`flex-row items-baseline gap-2 mb-3`}>
        <T style={tw`font-bold text-ink`}>{t('design.rewards')}</T>
        <T style={tw`text-slate text-xs`}>{t('design.topPositions', { count: c.prizeTiers.length })}</T>
      </View>
      {c.prizeTiers.map((r, i) => (
        <View
          key={r.rank}
          style={[tw`flex-row items-center justify-between py-2.5`, i > 0 && tw`border-t border-neutral-100`]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <RewardIcon rank={r.rank} />
            <T style={tw`text-sm font-medium text-ink`}>{t('design.place', { place: ordinal(r.rank) })}</T>
          </View>
          <T style={tw`text-teal font-bold`}>{inr(r.amountPaise)}</T>
        </View>
      ))}
      <View style={tw`mt-3 flex-row items-center justify-between border-t border-neutral-100 pt-3`}>
        <T style={tw`text-sm font-bold text-ink`}>{t('design.totalPrizePool')}</T>
        <T style={tw`text-teal font-extrabold`}>{inr(c.prizePoolPaise)}</T>
      </View>
    </Card>
  );
}

function RazorpayMark({ dark }: { dark?: boolean }) {
  return (
    <View style={tw`flex-row items-center gap-1`}>
      <Svg width={12} height={14} viewBox="0 0 24 26">
        <Path d="M14.5 0L7 14h4l-3.5 12L20 8h-5l3-8z" fill="#3395ff" />
      </Svg>
      <T style={[tw`font-bold text-[12px]`, { color: dark ? '#072654' : '#ffffff' }]}>Razorpay</T>
    </View>
  );
}

/** Prize money + refund card: how winnings arrive, the refund policy and the gateway. */
function PrizeInfoCard() {
  const { t } = useTranslation();
  return (
    <Card style={tw`flex-row items-center gap-3`}>
      <View style={[tw`flex-row items-center gap-2.5 pr-3 border-r border-neutral-100`, { width: '52%' }]}>
        <View style={tw`w-9 h-9 rounded-full bg-teal items-center justify-center`}>
          <PathIcon d={WALLET} size={18} color="#fff" />
        </View>
        <View style={tw`min-w-0 flex-1`}>
          <T style={tw`text-[12px] font-semibold text-ink leading-tight`}>{t('design.prizeQ')}</T>
          <T style={tw`text-[10px] text-slate mt-0.5`}>{t('design.prizeA')}</T>
        </View>
      </View>
      <View style={tw`flex-1 min-w-0 gap-1.5`}>
        <View style={tw`flex-row items-center gap-1.5`}>
          <Shield color={color('teal')} />
          <T style={tw`text-[10px] text-slate flex-1`}>{t('design.refundPolicy')}</T>
        </View>
        <View style={tw`flex-row items-start gap-1.5`}>
          <View style={tw`mt-0.5`}>
            <Shield color={color('teal')} />
          </View>
          <View style={tw`flex-1`}>
            <T style={tw`text-[10px] text-slate leading-snug`}>{t('design.securePayments')}</T>
            <View style={tw`flex-row`}>
              <RazorpayMark dark />
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- call to action

function StickyCta({ c, busy, onRegister }: { c: CompetitionDetail; busy: boolean; onRegister: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const notify = useNotify(c.id);
  const v = c.viewer;
  const reg =
    v?.registration && (v.registration.status === 'HELD' || v.registration.status === 'CONFIRMED')
      ? v.registration
      : null;

  let title: string;
  let sub: string | null = null;
  let onPress: (() => void) | null = null;
  let icon: ReactNode = null;

  if (c.status === 'CANCELLED') {
    title = t('detail.cancelled');
  } else if (v?.isHost) {
    title =
      c.phase === 'JUDGING'
        ? t('detail.judgeEntries')
        : c.phase === 'COMPLETED'
          ? t('detail.viewResults')
          : t('detail.manage');
    sub = t('detail.youAreHost');
    onPress =
      c.phase === 'JUDGING'
        ? () => router.push(`/competition/${c.id}/judge`)
        : c.phase === 'COMPLETED'
          ? () => router.push(`/competition/${c.id}/leaderboard`)
          : () => router.push('/my-competitions');
  } else if (c.phase === 'COMPLETED') {
    title = t('detail.viewResults');
    onPress = () => router.push(`/competition/${c.id}/leaderboard`);
  } else if (reg?.status === 'CONFIRMED') {
    title = t('design.uploadSubmission');
    sub = t('design.registeredBadge');
    onPress = () => router.push(`/submission/${reg.id}`);
  } else if (reg?.status === 'HELD') {
    title = t('detail.resumePayment');
    sub = t('design.spotHeld');
    onPress = onRegister;
  } else if (c.phase === 'UPCOMING') {
    const on = !!v?.notifyOn;
    title = on ? t('detail.notifyOn') : t('detail.notify');
    sub = t('design.opensSoon');
    icon = on ? <CheckCircle color="#fff" /> : <Bell size={16} color="#fff" />;
    onPress = () => requireSignIn(`/competition/${c.id}`) && notify.mutate(!on);
  } else if (c.phase !== 'OPEN') {
    title = t('detail.closed');
  } else if (c.spotsRemaining === 0) {
    title = t('detail.full');
  } else {
    title =
      c.entryFeePaise === 0
        ? t('design.registerFree')
        : t('design.register', { amount: inr(c.fees.totalPaise) });
    sub = t('design.spotsLeftShort', { count: c.spotsRemaining });
    onPress = onRegister;
  }

  const disabled = !onPress || busy || notify.isPending;
  return (
    <View style={[tw`absolute left-0 right-0 px-4`, { bottom: 68 }]}>
      <Press
        onPress={onPress ?? (() => undefined)}
        disabled={disabled}
        accessibilityLabel={title}
        accessibilityState={{ disabled, busy }}
        style={[tw`w-full rounded-xl bg-teal py-3 items-center shadow-lg`, !onPress && tw`opacity-60`]}
      >
        <View style={tw`flex-row items-center gap-2`}>
          {busy ? <Spinner /> : icon}
          <T style={tw`font-bold text-white`}>{title}</T>
        </View>
        {sub ? <T style={[tw`text-xs text-white`, { opacity: 0.8 }]}>{sub}</T> : null}
      </Press>
    </View>
  );
}

// ---------------------------------------------------------------- checkout (FR-PT-04…07)

type Method = 'upi' | 'cards' | 'netbanking' | 'wallets';
type Phase = 'method' | 'processing' | 'success' | 'failed';
const METHODS: Method[] = ['upi', 'cards', 'netbanking', 'wallets'];
const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM'];
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra'];
const WALLETS = ['Paytm', 'Amazon Pay', 'Mobikwik', 'Freecharge'];

function MethodIcon({ m, c }: { m: Method; c: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: c,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  if (m === 'upi')
    return (
      <Svg {...common}>
        <Path d="M4 12l6-8 4 16 6-8" />
      </Svg>
    );
  if (m === 'cards')
    return (
      <Svg {...common}>
        <Rect x="3" y="6" width="18" height="12" rx="2" />
        <Path d="M3 10h18M7 15h3" />
      </Svg>
    );
  if (m === 'netbanking')
    return (
      <Svg {...common}>
        <Path d="M4 10h16M5 10l7-5 7 5M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16" />
      </Svg>
    );
  return (
    <Svg {...common}>
      <Path d={WALLET} />
    </Svg>
  );
}

/**
 * The design's gateway sheet. With the fake provider (local demos) it is the checkout:
 * paying simulates the provider's capture. With Razorpay the real checkout opens instead
 * and this sheet only shows processing and the outcome. Either way the registration is
 * confirmed by the server once the webhook lands, never by this screen (FR-PT-04).
 */
function CheckoutSheet({
  c,
  registration,
  onClose,
  onPaid,
  onEnded,
}: {
  c: CompetitionDetail;
  registration: RegistrationView;
  onClose: () => void;
  onPaid: () => void;
  /** The hold expired or was refused: the next attempt needs a new idempotency key. */
  onEnded: () => void;
}) {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const checkout = registration.checkout as CheckoutDetails;
  const fake = isFakeCheckout(checkout);
  const fees = feeBreakdown(c.entryFeePaise);
  const [phase, setPhase] = useState<Phase>('method');
  const [method, setMethod] = useState<Method>('upi');
  const [upiApp, setUpiApp] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState({ num: '', name: '', exp: '', cvv: '' });
  const [bank, setBank] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const canPay =
    !fake ||
    (method === 'upi' && (upiApp !== null || upiId.trim().length > 2)) ||
    (method === 'cards' &&
      card.num.replace(/\s/g, '').length >= 12 &&
      card.name.trim().length > 1 &&
      card.exp.length >= 4 &&
      card.cvv.length >= 3) ||
    (method === 'netbanking' && bank !== null) ||
    (method === 'wallets' && wallet !== null);

  /** Polls until the server confirms or refuses; the checkout callback alone proves nothing. */
  const waitForOutcome = async () => {
    for (let i = 0; i < 40; i++) {
      const r = await getRegistration(registration.id);
      if (r.status === 'CONFIRMED') return setPhase('success');
      if (r.status === 'REJECTED' || r.status === 'EXPIRED') {
        onEnded();
        setFailure(r.status === 'EXPIRED' ? t('join.expired') : t('join.rejected'));
        return setPhase('failed');
      }
      if (r.lastPaymentError && i > 0) {
        setFailure(t('join.failedBody', { reason: r.lastPaymentError }));
        return setPhase('failed');
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
    setFailure(t('join.processingBody'));
    setPhase('failed');
  };

  const pay = async (outcome: 'captured' | 'failed' = 'captured') => {
    setPhase('processing');
    setFailure(null);
    try {
      if (fake) {
        await simulateFakePayment(checkout, outcome);
      } else {
        const result = await openRazorpayCheckout(
          checkout,
          { email: user?.email, name: user?.displayName ?? undefined },
          c.title,
        );
        if (result === 'dismissed') return setPhase('method');
      }
      await waitForOutcome();
    } catch (e) {
      setFailure(errorMessage(e, t));
      setPhase('failed');
    }
  };

  const field = [
    tw`w-full rounded-xl bg-white px-3.5 py-3 text-sm text-ink`,
    ring(1, color('neutral-200')),
    { fontFamily: 'Poppins_400Regular' },
  ];
  const choice = (on: boolean) => [
    tw`rounded-xl border items-center`,
    on ? tw`border-teal bg-mint` : tw`border-neutral-200 bg-white`,
  ];

  return (
    <BottomSheet open bare onClose={phase === 'processing' ? () => undefined : onClose} tone="canvas">
      <View>
        {/* Gateway header, in the provider's own colours so it reads as the external checkout. */}
        <View style={[tw`px-5 pt-4 pb-4`, { backgroundColor: '#02042b' }]}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              <View style={tw`w-8 h-8 rounded-lg bg-teal items-center justify-center`}>
                <T style={tw`font-extrabold text-sm text-white`}>f</T>
              </View>
              <View>
                <T style={tw`text-sm font-bold text-white leading-tight`}>feedants</T>
                <T style={tw`text-[10px] text-white/60 leading-tight`} numberOfLines={1}>
                  {c.title}
                </T>
              </View>
            </View>
            {phase !== 'processing' ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('design.cancelPayment')}
                style={tw`w-8 h-8 rounded-full bg-white/10 items-center justify-center`}
              >
                <PathIcon d="M6 6l12 12M18 6L6 18" size={16} color="rgba(255,255,255,0.8)" />
              </Pressable>
            ) : null}
          </View>
          <View style={tw`mt-4 flex-row items-end justify-between`}>
            <View>
              <T style={tw`text-[11px] text-white/60`}>{t('design.totalPayable')}</T>
              <T style={[tw`text-2xl font-extrabold text-white`, { fontVariant: ['tabular-nums'] }]}>
                {inr(fees.totalPaise)}
              </T>
            </View>
            <RazorpayMark />
          </View>
        </View>

        {phase === 'method' ? (
          <>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={tw`px-5 py-5 gap-5`}>
              {fake ? (
                <>
                  <View>
                    <T style={tw`text-xs font-semibold text-slate mb-2.5`}>{t('design.payUsing')}</T>
                    <View style={tw`flex-row gap-2`}>
                      {METHODS.map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => setMethod(m)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: method === m }}
                          style={[
                            tw`flex-1 gap-1.5 rounded-2xl border py-3 items-center`,
                            method === m ? tw`border-teal bg-mint` : tw`border-neutral-200 bg-white`,
                          ]}
                        >
                          <MethodIcon m={m} c={method === m ? color('teal-dark') : color('slate')} />
                          <T
                            style={tw`text-[11px] font-semibold leading-none ${method === m ? 'text-teal-dark' : 'text-slate'}`}
                          >
                            {t(`design.methods.${m}`)}
                          </T>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  {method === 'upi' ? (
                    <View style={tw`gap-3`}>
                      <View style={tw`flex-row gap-2`}>
                        {UPI_APPS.map((a) => (
                          <Pressable
                            key={a}
                            onPress={() => {
                              setUpiApp(a);
                              setUpiId('');
                            }}
                            accessibilityRole="button"
                            style={[choice(upiApp === a), tw`flex-1 py-2.5`]}
                          >
                            <T
                              style={tw`text-xs font-semibold ${upiApp === a ? 'text-teal-dark' : 'text-slate'}`}
                            >
                              {a}
                            </T>
                          </Pressable>
                        ))}
                      </View>
                      <View>
                        <T style={tw`text-[11px] text-slate`}>{t('design.upiIdLabel')}</T>
                        <TextInput
                          value={upiId}
                          onChangeText={(v) => {
                            setUpiId(v);
                            setUpiApp(null);
                          }}
                          placeholder={t('design.upiIdPlaceholder')}
                          placeholderTextColor={color('slate')}
                          autoCapitalize="none"
                          style={[...field, tw`mt-1`]}
                        />
                      </View>
                    </View>
                  ) : null}
                  {method === 'cards' ? (
                    <View style={tw`gap-2.5`}>
                      <TextInput
                        inputMode="numeric"
                        value={card.num}
                        onChangeText={(v) =>
                          setCard((s) => ({
                            ...s,
                            num: v
                              .replace(/\D/g, '')
                              .slice(0, 16)
                              .replace(/(.{4})/g, '$1 ')
                              .trim(),
                          }))
                        }
                        placeholder={t('design.cardNumber')}
                        placeholderTextColor={color('slate')}
                        style={field}
                      />
                      <TextInput
                        value={card.name}
                        onChangeText={(v) => setCard((s) => ({ ...s, name: v }))}
                        placeholder={t('design.nameOnCard')}
                        placeholderTextColor={color('slate')}
                        style={field}
                      />
                      <View style={tw`flex-row gap-2.5`}>
                        <TextInput
                          value={card.exp}
                          onChangeText={(v) =>
                            setCard((s) => ({
                              ...s,
                              exp: v
                                .replace(/\D/g, '')
                                .slice(0, 4)
                                .replace(/(.{2})(.+)/, '$1 / $2'),
                            }))
                          }
                          placeholder={t('design.expiry')}
                          placeholderTextColor={color('slate')}
                          style={[...field, tw`flex-1`]}
                        />
                        <TextInput
                          inputMode="numeric"
                          secureTextEntry
                          value={card.cvv}
                          onChangeText={(v) =>
                            setCard((s) => ({ ...s, cvv: v.replace(/\D/g, '').slice(0, 3) }))
                          }
                          placeholder={t('design.cvv')}
                          placeholderTextColor={color('slate')}
                          style={[...field, tw`flex-1`]}
                        />
                      </View>
                    </View>
                  ) : null}
                  {method === 'netbanking' ? (
                    <View style={tw`gap-1.5`}>
                      {BANKS.map((b) => (
                        <Pressable
                          key={b}
                          onPress={() => setBank(b)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: bank === b }}
                          style={[
                            tw`w-full flex-row items-center justify-between rounded-xl border px-3.5 py-3`,
                            bank === b ? tw`border-teal bg-mint` : tw`border-neutral-200 bg-white`,
                          ]}
                        >
                          <T style={tw`text-sm font-medium ${bank === b ? 'text-teal-dark' : 'text-ink'}`}>
                            {b}
                          </T>
                          <View
                            style={[
                              tw`w-4 h-4 rounded-full border-2`,
                              bank === b ? tw`border-teal bg-teal` : tw`border-neutral-300`,
                            ]}
                          />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {method === 'wallets' ? (
                    <View style={tw`flex-row flex-wrap gap-2.5`}>
                      {WALLETS.map((w) => (
                        <Pressable
                          key={w}
                          onPress={() => setWallet(w)}
                          accessibilityRole="button"
                          style={[choice(wallet === w), tw`py-3`, { width: '48.5%' }]}
                        >
                          <T
                            style={tw`text-sm font-semibold ${wallet === w ? 'text-teal-dark' : 'text-slate'}`}
                          >
                            {w}
                          </T>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <T style={tw`text-sm text-slate`}>{t('design.razorpayNext')}</T>
              )}
            </ScrollView>

            <View style={tw`border-t border-neutral-100 bg-white`}>
              {billOpen ? (
                <View style={tw`px-5 pt-3 gap-2`}>
                  <Row label={t('join.entryFee')} value={inr(fees.entryFeePaise)} />
                  <Row label={t('join.platformFee')} value={inr(fees.platformFeePaise)} />
                </View>
              ) : null}
              <View style={tw`px-5 py-3`}>
                <Pressable
                  onPress={() => setBillOpen((o) => !o)}
                  accessibilityRole="button"
                  style={tw`w-full flex-row items-center justify-between py-1`}
                >
                  <View style={tw`flex-row items-center gap-1`}>
                    <T style={tw`text-xs font-semibold text-slate`}>{inr(fees.totalPaise)}</T>
                    <Chevron size={14} color={color('slate')} rotate={billOpen ? 180 : 0} />
                  </View>
                  <View style={tw`rounded-md bg-mint px-2 py-0.5`}>
                    <T style={tw`text-teal-dark text-[10px] font-semibold`}>{t('design.testModeBadge')}</T>
                  </View>
                </Pressable>
                <Press
                  onPress={() => void pay()}
                  disabled={!canPay}
                  style={[
                    tw`mt-1.5 w-full rounded-xl py-3.5 items-center shadow-sm`,
                    { backgroundColor: '#3395ff' },
                    !canPay && { opacity: 0.4 },
                  ]}
                >
                  <T style={tw`text-sm font-bold text-white`}>
                    {t('design.payAmount', { amount: inr(fees.totalPaise) })}
                  </T>
                </Press>
                <View style={tw`mt-2.5 flex-row items-center justify-center gap-1.5`}>
                  <Shield color={color('teal')} />
                  <T style={tw`text-[11px] text-slate`}>{t('design.encrypted')}</T>
                </View>
                {fake ? (
                  <Pressable
                    onPress={() => void pay('failed')}
                    accessibilityRole="button"
                    style={tw`mt-1 self-center py-1`}
                  >
                    <T style={[tw`text-[11px] text-slate`, { textDecorationLine: 'underline' }]}>
                      {t('design.simulateFailure')}
                    </T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        {phase === 'processing' ? (
          <View style={tw`px-6 py-16 items-center`} accessibilityLiveRegion="polite">
            <Spinner light={false} />
            <T style={tw`mt-6 text-base font-bold text-ink`}>{t('join.processing')}</T>
            <T style={tw`mt-1 text-sm text-slate text-center`}>{t('join.processingBody')}</T>
            <View style={tw`mt-6 flex-row items-center gap-1.5`}>
              <T style={tw`text-[11px] text-slate`}>{t('design.poweredBy')}</T>
              <RazorpayMark dark />
            </View>
          </View>
        ) : null}

        {phase === 'success' ? (
          <View style={tw`px-6 py-12 items-center`} accessibilityLiveRegion="polite">
            <View style={tw`w-20 h-20 rounded-full bg-teal items-center justify-center`}>
              <PathIcon d="M5 13l4 4L19 7" size={40} color="#fff" strokeWidth={2.4} />
            </View>
            <T style={tw`mt-6 text-xl font-extrabold text-ink`}>{t('design.paymentSuccess')}</T>
            <T style={[tw`mt-1 text-3xl font-extrabold text-teal`, { fontVariant: ['tabular-nums'] }]}>
              {inr(fees.totalPaise)}
            </T>
            <T style={tw`mt-2 text-sm text-slate text-center max-w-[260px]`}>
              {t('design.paidFor', { title: c.title })}
            </T>
            <View style={tw`mt-4 flex-row items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm`}>
              <T style={tw`text-[11px] text-slate`}>{t('design.txnId')}</T>
              <T style={tw`text-[11px] font-semibold text-ink tracking-wide`}>{checkout.providerOrderId}</T>
            </View>
            <Press onPress={onPaid} style={tw`mt-8 w-full rounded-xl bg-teal py-3.5 items-center`}>
              <T style={tw`text-sm font-bold text-white`}>{t('design.done')}</T>
            </Press>
          </View>
        ) : null}

        {phase === 'failed' ? (
          <View style={tw`px-6 py-12 items-center`} accessibilityLiveRegion="polite">
            <View style={tw`w-20 h-20 rounded-full bg-red-50 items-center justify-center`}>
              <PathIcon d="M6 6l12 12M18 6L6 18" size={40} color={color('red-500')} strokeWidth={2.4} />
            </View>
            <T style={tw`mt-6 text-xl font-extrabold text-ink`}>{t('join.failed')}</T>
            <T style={tw`mt-2 text-sm text-slate text-center max-w-[260px]`}>
              {failure ?? t('design.paymentFailedSub')}
            </T>
            <Press
              onPress={() => setPhase('method')}
              style={tw`mt-8 w-full rounded-xl bg-teal py-3.5 items-center`}
            >
              <T style={tw`text-sm font-bold text-white`}>{t('common.retry')}</T>
            </Press>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={tw`flex-row items-center justify-between`}>
    <T style={tw`text-sm text-slate`}>{label}</T>
    <T style={[tw`text-sm font-semibold text-ink`, { fontVariant: ['tabular-nums'] }]}>{value}</T>
  </View>
);

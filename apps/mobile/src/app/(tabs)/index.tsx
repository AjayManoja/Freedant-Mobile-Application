import type { Category, CompetitionSummary, HomeResponse } from '@feedants/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHome, useNotify, useUnreadCount } from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import { ErrorState, Loading } from '@/components/ui';
import {
  Card,
  CompetitionRow,
  CoverImage,
  ExpandToggle,
  inr,
  PersonAvatar,
  Press,
  SectionHeader,
  useCountdownLabel,
} from '@/design/components';
import { Gradient } from '@/design/gradient';
import {
  Bell,
  Calendar,
  CheckCircle,
  Chevron,
  Clock,
  Fire,
  Megaphone,
  Search,
  Star,
  Trophy,
  Upload,
  Users,
} from '@/design/icons';
import { T } from '@/design/text';
import { categoryStyle } from '@/design/categories';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatShortDate } from '@/lib/format';

/** HomePage `upcomingTints`. */
const UPCOMING_TINTS = [
  { bg: 'bg-rose-50', fg: 'rose-400' },
  { bg: 'bg-indigo-50', fg: 'indigo-400' },
  { bg: 'bg-amber-50', fg: 'amber-500' },
];

const greeting = (t: (k: string) => string) => {
  const h = new Date().getHours();
  return t(h < 12 ? 'design.morning' : h < 17 ? 'design.afternoon' : 'design.evening');
};

/** US-08, US-13, FR-DS-01/02 — design/prototype/src/pages/HomePage.tsx. Empty sections are hidden. */
export default function Home() {
  const { t } = useTranslation();
  const home = useHome();

  if (home.isPending) return <Loading />;
  if (home.isError && !home.data) {
    return <ErrorState message={errorMessage(home.error, t)} onRetry={() => void home.refetch()} />;
  }
  return <HomeContent h={home.data!} refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />;
}

function HomeContent({
  h,
  refreshing,
  onRefresh,
}: {
  h: HomeResponse;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setShowAll((s) => ({ ...s, [k]: !s[k] }));

  const list = (key: 'endingSoon' | 'topPrize', title: string) => {
    const items = h[key];
    if (items.length === 0) return null;
    return (
      <View>
        <SectionHeader title={title} />
        <View style={tw`gap-3`}>
          {(showAll[key] ? items : items.slice(0, 3)).map((c) => (
            <CompetitionRow key={c.id} c={c} />
          ))}
        </View>
        <ExpandToggle expanded={!!showAll[key]} hidden={items.length - 3} onToggle={() => toggle(key)} />
      </View>
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <Header />
        <ScrollView
          contentContainerStyle={tw`px-4 pb-28 gap-5`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color('teal')} />
          }
        >
          <Press
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel={t('design.search')}
            scale={1}
            style={tw`w-full flex-row items-center gap-2 rounded-xl bg-white shadow-sm px-4 py-3`}
          >
            <Search size={20} color={color('slate')} />
            <T style={tw`flex-1 text-sm text-slate`}>{t('design.search')}</T>
          </Press>

          {h.me ? (
            <Card style={tw`flex-row items-stretch overflow-hidden`}>
              <Stat
                icon={<Trophy size={16} color={color('teal')} />}
                value={h.me.joined}
                label={t('design.joined')}
              />
              <Stat
                icon={<Star size={16} color={color('teal')} />}
                value={h.me.won}
                label={t('design.wonStat')}
                divider
              />
            </Card>
          ) : null}

          {h.featured ? <Featured c={h.featured} /> : null}

          {h.categories.length > 0 ? (
            <View>
              <SectionHeader
                title={t('design.categories')}
                action={t('design.explore')}
                onAction={() => router.push('/explore')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={tw`-mx-1`}
                contentContainerStyle={tw`px-1 gap-3`}
              >
                {h.categories.map((c) => (
                  <CategoryTile key={c.id} c={c} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {h.me?.draft ? <DraftCard draft={h.me.draft} /> : null}

          {h.trending.length > 0 ? (
            <View>
              <SectionHeader
                title={t('design.trendingNow')}
                action={t('design.seeAll')}
                onAction={() => router.push({ pathname: '/explore/[type]', params: { type: 'trending' } })}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={tw`-mx-1`}
                contentContainerStyle={tw`px-1 gap-3`}
              >
                {h.trending.map((c) => (
                  <TrendingCard key={c.id} c={c} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {h.topHosts.length > 0 ? (
            <View>
              <SectionHeader
                title={t('design.topHosts')}
                action={t('design.seeAll')}
                onAction={() => router.push('/explore')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={tw`-mx-1`}
                contentContainerStyle={tw`px-1 gap-3`}
              >
                {h.topHosts.map((host, i) => (
                  <Press
                    key={host.id}
                    onPress={() => router.push({ pathname: '/search', params: { q: host.displayName } })}
                    accessibilityLabel={host.displayName}
                    style={tw`w-[150px] rounded-2xl bg-white shadow-sm p-3.5`}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <PersonAvatar uri={host.avatarUrl} name={host.displayName} index={i} size={44} />
                      <View style={tw`min-w-0 flex-1`}>
                        <T style={tw`font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
                          {host.displayName}
                        </T>
                        <View style={tw`flex-row items-center gap-0.5`}>
                          <Trophy size={12} color={color('amber-400')} />
                          <T style={tw`flex-1 text-[11px] text-slate`} numberOfLines={1}>
                            {t('design.completed', { count: host.completed })}
                          </T>
                        </View>
                      </View>
                    </View>
                    <View style={tw`mt-3 flex-row items-center justify-between`}>
                      <View style={tw`flex-1 items-center`}>
                        <T style={tw`text-ink font-extrabold text-sm leading-none`}>{host.competitionsRun}</T>
                        <T style={tw`text-[10px] text-slate mt-1`}>{t('design.contests')}</T>
                      </View>
                      <View style={tw`flex-1 items-center border-l border-neutral-100`}>
                        <T style={tw`text-teal font-extrabold text-sm leading-none`}>
                          {compact(host.participants)}
                        </T>
                        <T style={tw`text-[10px] text-slate mt-1`}>{t('design.entrants')}</T>
                      </View>
                    </View>
                  </Press>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {h.upcoming.length > 0 ? (
            <View>
              <SectionHeader title={t('design.upcoming')} />
              <View style={tw`gap-3`}>
                {(showAll.upcoming ? h.upcoming : h.upcoming.slice(0, 3)).map((c, i) => (
                  <UpcomingRow key={c.id} c={c} index={i} />
                ))}
              </View>
              <ExpandToggle
                expanded={!!showAll.upcoming}
                hidden={h.upcoming.length - 3}
                onToggle={() => toggle('upcoming')}
              />
            </View>
          ) : null}

          {list('endingSoon', t('design.endingSoon'))}
          {list('topPrize', t('design.topPrize'))}

          {h.recentWinners.length > 0 ? (
            <View>
              <SectionHeader title={t('design.recentWinners')} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={tw`-mx-1`}
                contentContainerStyle={tw`px-1 gap-3`}
              >
                {h.recentWinners.map((w, i) => (
                  <Press
                    key={`${w.competitionId}-${w.userId}`}
                    onPress={() => router.push(`/winners/${w.userId}`)}
                    accessibilityLabel={`${w.displayName}, ${w.competitionTitle}`}
                    scale={0.98}
                    style={tw`w-[160px] rounded-2xl bg-white shadow-sm overflow-hidden`}
                  >
                    <View style={tw`h-20`}>
                      <CoverImage uri={w.competitionCoverUrl} style={tw`absolute inset-0`} />
                      <Gradient
                        dir="t"
                        colors={['rgba(27,43,58,0.7)', 'rgba(27,43,58,0)']}
                        style={tw`absolute inset-0`}
                      />
                      <View
                        style={tw`absolute top-2 left-2 flex-row items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 shadow-sm`}
                      >
                        <Trophy size={12} color="#fff" />
                        <T style={tw`text-[10px] font-bold text-white`}>{t('design.winner')}</T>
                      </View>
                    </View>
                    <View style={tw`p-3 -mt-6`}>
                      <PersonAvatar
                        uri={w.avatarUrl}
                        name={w.displayName}
                        index={i}
                        size={40}
                        style={ring(2, '#ffffff')}
                      />
                      <T style={tw`mt-2 font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
                        {w.displayName}
                      </T>
                      <T style={tw`text-[11px] text-slate`} numberOfLines={1}>
                        {w.competitionTitle}
                      </T>
                      <T style={tw`mt-1 text-[11px] font-semibold text-teal`}>
                        {t('design.won', { amount: inr(w.prizePaise) })}
                      </T>
                    </View>
                  </Press>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <HostCta />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Header() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const unread = useUnreadCount();
  const name = user?.displayName ?? '';
  const count = unread.data?.unread ?? 0;
  return (
    <View style={tw`flex-row items-center justify-between px-5 pt-4 pb-3`}>
      <Pressable
        onPress={() => (user ? router.push('/profile') : requireSignIn('/'))}
        accessibilityRole="button"
        accessibilityLabel={user ? name : t('profile.signIn')}
        style={tw`flex-row items-center gap-3`}
      >
        <PersonAvatar
          uri={user?.avatarUrl}
          name={name || 'F'}
          index={0}
          size={44}
          style={{ boxShadow: '0 0 0 2px #f2f4f5, 0 0 0 4px rgba(13,128,116,0.3)' }}
        />
        <View>
          <T style={tw`text-slate text-xs`}>{greeting(t)}</T>
          <T style={tw`text-lg font-extrabold text-ink leading-tight`}>{name || t('design.guestName')}</T>
        </View>
      </Pressable>
      {user ? (
        <Press
          onPress={() => router.push('/notifications')}
          accessibilityLabel={count ? `${t('notifications.title')}, ${count}` : t('notifications.title')}
          scale={0.95}
          style={tw`w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center`}
        >
          <Bell size={20} color={color('ink')} />
          {count > 0 ? (
            <View
              style={[tw`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-teal`, ring(2, '#ffffff')]}
            />
          ) : null}
        </Press>
      ) : null}
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
  divider,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        tw`flex-1 flex-row items-center justify-center gap-2.5 py-3.5`,
        divider && tw`border-l border-neutral-100`,
      ]}
    >
      <View style={tw`w-9 h-9 rounded-xl bg-mint items-center justify-center`}>{icon}</View>
      <View>
        <T style={tw`text-lg font-extrabold text-ink leading-none`}>{value}</T>
        {/* The value's wrapper is leading-none, so the label inherits a 1.0 line height. */}
        <T style={tw`text-[11px] leading-none text-slate mt-1`}>{label}</T>
      </View>
    </View>
  );
}

function Featured({ c }: { c: CompetitionSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  const ends = useCountdownLabel(c);
  const open = () => router.push(`/competition/${c.id}`);
  return (
    <View style={tw`w-full rounded-3xl shadow-lg`}>
      <View style={tw`w-full h-48 rounded-3xl overflow-hidden`}>
        <CoverImage uri={c.coverUrl} style={tw`absolute inset-0`} />
        <Gradient
          dir="t"
          colors={['rgba(27,43,58,0.9)', 'rgba(27,43,58,0.35)', 'rgba(27,43,58,0.1)']}
          style={tw`absolute inset-0`}
        />
        <Press onPress={open} accessibilityLabel={c.title} style={tw`absolute inset-0 z-10`} />
        <View style={tw`absolute left-4 right-4 top-4 flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center gap-1 rounded-full bg-teal px-2.5 py-1 shadow-sm`}>
            <Fire size={14} color="#fff" />
            <T style={tw`text-[11px] font-semibold text-white`}>{t('design.featuredToday')}</T>
          </View>
        </View>
        <View style={[tw`absolute left-4 right-4 bottom-4`, { pointerEvents: 'box-none' }]}>
          <T style={tw`text-2xl font-extrabold leading-tight text-white`} numberOfLines={2}>
            {c.title}
          </T>
          <View style={tw`mt-2.5 flex-row items-center gap-2`}>
            <View style={tw`flex-row items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5`}>
              <Trophy size={14} color="#fff" />
              <T style={tw`text-xs font-semibold text-white`}>{inr(c.prizePoolPaise)}</T>
            </View>
            {ends ? (
              <View style={tw`flex-row items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5`}>
                <Clock color="#fff" />
                <T style={tw`text-xs font-semibold text-white`}>{ends}</T>
              </View>
            ) : null}
            <Press
              onPress={open}
              scale={0.95}
              style={tw`z-20 ml-auto flex-row items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 shadow-sm`}
            >
              <T style={tw`text-xs font-bold text-teal`}>{t('design.join')}</T>
              <Chevron size={14} color={color('teal')} rotate={-90} />
            </Press>
          </View>
        </View>
      </View>
    </View>
  );
}

function CategoryTile({ c }: { c: Category }) {
  const router = useRouter();
  const s = categoryStyle(c.slug);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/explore', params: { category: c.slug } })}
      accessibilityRole="button"
      accessibilityLabel={c.name}
      style={tw`items-center gap-1.5 w-16`}
    >
      <View style={tw`w-14 h-14 rounded-2xl items-center justify-center shadow-sm ${s.bg}`}>
        {s.icon(color(s.fg))}
      </View>
      {/* A label wider than the 64px tile overflows centred, as it does on the web. */}
      <T style={tw`w-24 text-center text-[11px] font-semibold text-ink`} numberOfLines={1}>
        {c.name}
      </T>
    </Pressable>
  );
}

function DraftCard({ draft }: { draft: NonNullable<NonNullable<HomeResponse['me']>['draft']> }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Press
      onPress={() => router.push(`/submission/${draft.registrationId}`)}
      accessibilityLabel={t('design.finishSubmission')}
      style={tw`rounded-2xl shadow-sm`}
    >
      <Gradient dir="br" colors={[color('teal'), color('teal-dark')]} style={tw`w-full rounded-2xl p-4`}>
        <View style={tw`flex-row items-center gap-3`}>
          <View style={tw`w-11 h-11 rounded-xl bg-white/20 items-center justify-center`}>
            <Upload color="#fff" />
          </View>
          <View style={tw`flex-1 min-w-0`}>
            <View style={tw`flex-row items-center justify-between gap-2`}>
              <T style={tw`font-bold text-sm text-white`}>{t('design.finishSubmission')}</T>
              <T style={tw`text-[11px] font-semibold text-white/90`}>{draft.percent}%</T>
            </View>
            <T style={tw`text-xs text-white/80`} numberOfLines={1}>
              {t('design.draftSaved', { title: draft.competitionTitle })}
            </T>
          </View>
          <Chevron size={16} color="rgba(255,255,255,0.9)" rotate={-90} />
        </View>
        <View style={tw`mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden`}>
          <View style={[tw`h-full rounded-full bg-white`, { width: `${draft.percent}%` }]} />
        </View>
      </Gradient>
    </Press>
  );
}

function TrendingCard({ c }: { c: CompetitionSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Press
      onPress={() => router.push(`/competition/${c.id}`)}
      accessibilityLabel={c.title}
      scale={1}
      style={tw`w-[200px] rounded-2xl bg-white shadow-sm overflow-hidden`}
    >
      <View style={tw`h-24`}>
        <CoverImage uri={c.coverUrl} style={tw`absolute inset-0`} />
        {c.category ? (
          <View style={tw`absolute top-2 left-2 rounded-md bg-black/45 px-2 py-0.5`}>
            <T style={tw`text-white text-[11px] font-medium`}>{c.category.name}</T>
          </View>
        ) : null}
        <View
          style={tw`absolute top-2 right-2 flex-row items-center gap-1 rounded-md bg-white/90 px-2 py-0.5`}
        >
          <Users color={color('teal')} />
          <T style={tw`text-teal text-[11px] font-semibold`}>{c.participants}</T>
        </View>
      </View>
      <View style={tw`p-3`}>
        <T style={tw`font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
          {c.title}
        </T>
        <View style={tw`mt-2 flex-row items-center justify-between`}>
          <View>
            <T style={tw`text-[10px] text-slate`}>{t('design.prizePool')}</T>
            <T style={tw`text-teal font-extrabold`}>{inr(c.prizePoolPaise)}</T>
          </View>
          <View style={tw`items-end`}>
            <T style={tw`text-[10px] text-slate`}>{t('design.entry')}</T>
            <T style={tw`text-ink font-bold text-sm`}>
              {c.entryFeePaise === 0 ? t('common.free') : inr(c.entryFeePaise)}
            </T>
          </View>
        </View>
      </View>
    </Press>
  );
}

function UpcomingRow({ c, index }: { c: CompetitionSummary; index: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const tint = UPCOMING_TINTS[index % UPCOMING_TINTS.length]!;
  // Home doesn't carry the viewer's subscription; the button reflects this session's taps.
  const [on, setOn] = useState(false);
  const notify = useNotify(c.id);
  const press = () => {
    if (!requireSignIn('/')) return;
    notify.mutate(!on, { onSuccess: () => setOn(!on) });
  };
  return (
    <Card style={tw`flex-row items-center gap-3`}>
      <View style={tw`w-12 h-12 rounded-xl items-center justify-center ${tint.bg}`}>
        <Calendar color={color(tint.fg)} />
      </View>
      <View style={tw`flex-1 min-w-0`}>
        <T
          style={tw`font-bold text-ink text-sm leading-tight`}
          numberOfLines={1}
          onPress={() => router.push(`/competition/${c.id}`)}
        >
          {c.title}
        </T>
        <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
          {t('design.upcomingMeta', {
            category: c.category?.name ?? '',
            date: formatShortDate(c.registrationOpensAt),
            entry: c.entryFeePaise === 0 ? t('common.free') : inr(c.entryFeePaise),
          })}
        </T>
        <T style={tw`text-[11px] text-slate mt-1`}>
          {t('design.prize')} <T style={tw`text-teal font-bold`}>{inr(c.prizePoolPaise)}</T>
        </T>
      </View>
      <Press
        onPress={press}
        disabled={notify.isPending}
        accessibilityState={{ selected: on }}
        style={[
          tw`flex-row items-center gap-1.5 rounded-lg px-3 py-2`,
          on ? tw`bg-teal` : [tw`bg-white border`, { borderColor: 'rgba(13,128,116,0.4)' }],
        ]}
      >
        {on ? <CheckCircle color="#fff" /> : <Bell size={16} color={color('teal')} />}
        <T style={tw`text-xs font-semibold ${on ? 'text-white' : 'text-teal'}`}>
          {on ? t('design.notified') : t('design.notify')}
        </T>
      </Press>
    </Card>
  );
}

function HostCta() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Press
      onPress={() => requireSignIn('/host') && router.push('/host')}
      accessibilityLabel={t('design.hostTitle')}
      style={tw`rounded-3xl shadow-sm`}
    >
      <Gradient
        dir="br"
        colors={[color('teal'), color('teal-dark')]}
        style={tw`w-full overflow-hidden rounded-3xl p-6`}
      >
        <View
          style={[
            tw`absolute -right-8 -bottom-10 h-40 w-40 rounded-full bg-white/10`,
            { pointerEvents: 'none' },
          ]}
        />
        <View style={tw`h-12 w-12 items-center justify-center rounded-2xl bg-white/15`}>
          <Megaphone size={24} color="#fff" />
        </View>
        <T style={tw`mt-4 text-xl font-extrabold leading-tight text-white`}>{t('design.hostTitle')}</T>
        <T style={tw`mt-1.5 max-w-[280px] text-sm leading-snug text-white/80`}>{t('design.hostBody')}</T>
        <View style={tw`mt-5 self-start flex-row items-center gap-2 rounded-xl bg-white px-5 py-2.5`}>
          <T style={tw`text-sm font-extrabold text-teal`}>{t('design.getStarted')}</T>
          <Chevron size={16} color={color('teal')} rotate={-90} />
        </View>
        <T style={tw`mt-3 text-[11px] text-white/70`}>{t('design.hostFoot')}</T>
      </Gradient>
    </Press>
  );
}

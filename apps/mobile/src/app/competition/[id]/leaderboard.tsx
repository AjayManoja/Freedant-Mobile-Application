import type { LeaderboardEntry } from '@feedants/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useCompetition, useLeaderboard } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { Loading } from '@/components/ui';
import { BottomNav } from '@/design/bottom-nav';
import { CoverImage, inr, PersonAvatar, Press } from '@/design/components';
import { EmptyState, NoEntriesArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import { ArrowLeft, Chevron, Search, Star, Trophy, Users } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { errorMessage, formatShortDate } from '@/lib/format';

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;
const score = (n: number) => n.toFixed(1);

/** FR-JG-05 — design/prototype/src/pages/LeaderboardPage.tsx, final-results mode. */
export default function LeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const lb = useLeaderboard(id);
  const competition = useCompetition(id);
  const me = useSession((s) => s.user?.id);
  const [query, setQuery] = useState('');

  const entries = useMemo(() => lb.data?.entries ?? [], [lb.data]);
  const rest = useMemo(() => {
    const q = query.trim().toLowerCase();
    const after = entries.slice(3);
    return q ? after.filter((e) => e.creator.displayName.toLowerCase().includes(q)) : after;
  }, [entries, query]);
  const you = entries.find((e) => e.creator.id === me);
  const open = (e: LeaderboardEntry) =>
    e.creator.id === me ? router.push('/profile') : router.push(`/winners/${e.creator.id}`);

  const c = competition.data;
  const notPublished = lb.error instanceof ApiError && lb.error.status === 404;

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <View style={tw`h-40`}>
          <CoverImage uri={c?.coverUrl ?? null} style={tw`absolute inset-0`} />
          <Gradient
            dir="b"
            colors={['rgba(27,43,58,0.85)', 'rgba(27,43,58,0.45)', color('canvas')]}
            style={tw`absolute inset-0`}
          />
          <View style={tw`flex-row items-center justify-between px-5 pt-4`}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace(`/competition/${id}`))}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={tw`flex-row items-center gap-2`}
            >
              <ArrowLeft color="#fff" />
              <T style={tw`font-bold text-lg text-white`}>{t('common.back')}</T>
            </Pressable>
          </View>
          <View style={tw`mt-3 px-5`}>
            <T style={tw`text-[11px] font-semibold uppercase tracking-wide text-white/70`}>
              {t('design.finalResults')}
            </T>
            <T
              style={tw`text-xl font-extrabold leading-tight text-white`}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {lb.data?.title ?? c?.title ?? ''}
            </T>
          </View>
        </View>

        {lb.isPending ? (
          <Loading />
        ) : notPublished || lb.isError ? (
          <EmptyState
            style={tw`flex-1`}
            illustration={<NoEntriesArt />}
            title={notPublished ? t('leaderboard.notYet') : t('common.somethingWrong')}
            message={
              notPublished
                ? t('design.resultsLater', { date: formatShortDate(c?.resultsDueAt) })
                : errorMessage(lb.error, t)
            }
            primary={
              notPublished
                ? { label: t('design.backToCompetition'), onPress: () => router.back() }
                : { label: t('common.retry'), onPress: () => void lb.refetch() }
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={tw`px-4 pb-40`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={tw`mt-3 flex-row gap-2.5`}>
              <Meta
                icon={<Users color={color('teal')} />}
                value={String(entries.length)}
                label={t('design.entries')}
              />
              <Meta
                icon={<Trophy color={color('teal')} />}
                value={inr(c?.prizePoolPaise ?? 0)}
                label={t('design.prizePoolLower')}
              />
              <Meta
                icon={<Star color={color('teal')} />}
                value={formatShortDate(lb.data!.resultsPublishedAt)}
                label={t('design.announced')}
              />
            </View>

            {entries.length > 0 ? (
              <View style={tw`mt-5`}>
                <Podium top={entries.slice(0, 3)} me={me} onOpen={open} />
              </View>
            ) : null}

            {entries.length > 3 ? (
              <View style={tw`mt-4 flex-row items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm`}>
                <Search size={20} color={color('slate')} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('design.searchParticipants')}
                  placeholderTextColor={color('slate')}
                  accessibilityLabel={t('design.searchParticipants')}
                  style={[tw`flex-1 text-sm text-ink p-0`, { fontFamily: 'Poppins_400Regular', height: 20 }]}
                />
              </View>
            ) : null}

            <View style={tw`mt-3 gap-2.5`}>
              {rest.map((e) => (
                <Row key={e.submissionId} e={e} you={e.creator.id === me} onOpen={open} />
              ))}
              {entries.length > 3 && rest.length === 0 ? (
                <T style={tw`py-8 text-center text-sm text-slate`}>
                  {t('design.noParticipantMatch', { q: query })}
                </T>
              ) : null}
            </View>
          </ScrollView>
        )}

        {you ? (
          <View style={[tw`absolute left-0 right-0 px-4 z-30`, { bottom: 76 }]}>
            <Press
              onPress={() => router.push('/profile')}
              style={[
                tw`flex-row w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3`,
                { boxShadow: '0 12px 32px -8px rgba(27,43,58,0.5)' },
              ]}
            >
              <View style={tw`h-9 w-9 items-center justify-center rounded-full bg-white/10`}>
                <T style={[tw`text-sm font-extrabold text-white`, { fontVariant: ['tabular-nums'] }]}>
                  {you.rank}
                </T>
              </View>
              <View style={tw`min-w-0 flex-1`}>
                <T style={tw`text-sm font-bold text-white`}>{t('design.yourRank')}</T>
                <T style={tw`text-[11px] text-white/70`}>
                  {you.prizePaise > 0
                    ? `${t('design.place', { place: ordinal(you.rank) })} · ${inr(you.prizePaise)}`
                    : t('design.points', { score: score(you.score) })}
                </T>
              </View>
              <Chevron size={16} color="rgba(255,255,255,0.7)" rotate={-90} />
            </Press>
          </View>
        ) : null}
      </View>
      <BottomNav active="competitions" />
    </SafeAreaView>
  );
}

function Meta({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={tw`flex-1 rounded-2xl bg-white p-3 items-center shadow-sm`}>
      <View style={tw`h-8 w-8 items-center justify-center rounded-lg bg-mint`}>{icon}</View>
      <T style={tw`mt-1.5 text-sm font-extrabold text-ink leading-none`} numberOfLines={1}>
        {value}
      </T>
      <T style={tw`mt-1 text-[10px] text-slate`}>{label}</T>
    </View>
  );
}

const PODIUM = [
  { ring: '#ffd230', badge: 'bg-amber-400', pedestal: 80, size: 80 },
  { ring: '#cad5e2', badge: 'bg-slate-400', pedestal: 56, size: 64 },
  { ring: '#ffb86a', badge: 'bg-orange-400', pedestal: 40, size: 64 },
];

/** 2nd, 1st, 3rd so the champion sits centre-stage. */
function Podium({
  top,
  me,
  onOpen,
}: {
  top: LeaderboardEntry[];
  me: string | undefined;
  onOpen: (e: LeaderboardEntry) => void;
}) {
  const { t } = useTranslation();
  const order = [top[1], top[0], top[2]].filter((e): e is LeaderboardEntry => !!e);
  return (
    <View style={tw`flex-row items-end justify-center gap-3 px-2`}>
      {order.map((e) => {
        const st = PODIUM[e.rank - 1] ?? PODIUM[2]!;
        const champion = e.rank === 1;
        return (
          <Press
            key={e.submissionId}
            onPress={() => onOpen(e)}
            scale={0.98}
            accessibilityLabel={e.creator.displayName}
            style={tw`flex-1 max-w-[110px] items-center`}
          >
            {champion ? (
              <View style={tw`mb-1`}>
                <Trophy size={24} color={color('amber-400')} />
              </View>
            ) : null}
            <View>
              <PersonAvatar
                uri={e.creator.avatarUrl}
                name={e.creator.displayName}
                index={e.rank}
                size={st.size}
                style={{ boxShadow: `0 0 0 2px #f2f4f5, 0 0 0 6px ${st.ring}` }}
              />
              <View
                style={[
                  tw`absolute -bottom-1 self-center h-6 w-6 items-center justify-center rounded-full ${st.badge}`,
                  { boxShadow: '0 0 0 2px #f2f4f5' },
                ]}
              >
                <T style={tw`text-[11px] font-extrabold text-white`}>{e.rank}</T>
              </View>
            </View>
            <T style={tw`mt-2.5 w-full text-center text-[13px] font-bold text-ink`} numberOfLines={1}>
              {e.creator.id === me ? t('design.you') : e.creator.displayName}
            </T>
            {e.prizePaise > 0 ? (
              <T style={tw`text-[11px] font-bold text-teal`}>{inr(e.prizePaise)}</T>
            ) : (
              <T style={tw`text-[11px] font-semibold text-slate`}>
                {t('design.points', { score: score(e.score) })}
              </T>
            )}
            <Gradient
              dir="b"
              colors={
                champion ? [color('teal'), color('teal-dark')] : [color('neutral-200'), color('neutral-100')]
              }
              style={[tw`mt-2 w-full rounded-t-xl`, { height: st.pedestal }]}
            />
          </Press>
        );
      })}
    </View>
  );
}

function Row({
  e,
  you,
  onOpen,
}: {
  e: LeaderboardEntry;
  you: boolean;
  onOpen: (e: LeaderboardEntry) => void;
}) {
  const { t } = useTranslation();
  const medal = e.rank <= 3 ? ['amber-400', 'slate-400', 'orange-400'][e.rank - 1]! : 'slate';
  return (
    <Press
      onPress={() => onOpen(e)}
      accessibilityLabel={`${e.rank}. ${e.creator.displayName}`}
      style={[
        tw`flex-row w-full items-center gap-3 rounded-2xl p-3 shadow-sm`,
        you ? [tw`bg-mint`, { boxShadow: `0 0 0 2px ${color('teal')}` }] : tw`bg-white`,
      ]}
    >
      <T
        style={[
          tw`w-6 text-center text-sm font-extrabold`,
          { color: color(medal), fontVariant: ['tabular-nums'] },
        ]}
      >
        {e.rank}
      </T>
      <PersonAvatar
        uri={e.creator.avatarUrl}
        name={e.creator.displayName}
        index={e.rank}
        size={44}
        style={tw`rounded-xl`}
      />
      <View style={tw`min-w-0 flex-1`}>
        <View style={tw`flex-row items-center gap-1.5`}>
          <T style={tw`text-sm font-bold text-ink shrink`} numberOfLines={1}>
            {you ? t('design.you') : e.creator.displayName}
          </T>
          {you ? (
            <View style={tw`rounded-full bg-teal px-1.5 py-0.5`}>
              <T style={tw`text-[9px] font-extrabold text-white`}>{t('design.youBadge')}</T>
            </View>
          ) : null}
        </View>
        <T
          style={tw`text-[11px] font-semibold ${e.prizePaise > 0 ? 'text-teal' : 'text-slate'}`}
          numberOfLines={1}
        >
          {e.prizePaise > 0
            ? `${t('design.place', { place: ordinal(e.rank) })} · ${inr(e.prizePaise)}`
            : t('design.notPlaced')}
        </T>
      </View>
      <T style={[tw`text-sm font-extrabold text-ink leading-none`, { fontVariant: ['tabular-nums'] }]}>
        {score(e.score)}
        <T style={tw`text-[10px] font-semibold text-slate`}> {t('design.pts')}</T>
      </T>
    </Press>
  );
}

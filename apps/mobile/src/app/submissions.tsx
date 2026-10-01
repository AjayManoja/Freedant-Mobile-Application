import type { SubmissionDisplayStatus, SubmissionView } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useMySubmissions, useMySubmissionsSummary } from '@/api/hooks';
import { useRequireSignIn } from '@/auth/session';
import { Loading } from '@/design/loading';
import { BottomNav } from '@/design/bottom-nav';
import { BackHeader, CoverImage, FilterChips, inr, Press, StatusPill } from '@/design/components';
import { EmptyState, NoEntriesArt, NoNetworkArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import { Camera, Chat, Clock, Play, Trophy, Upload } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatShortDate, formatWhen } from '@/lib/format';

type Filter = 'ALL' | SubmissionDisplayStatus;
const FILTERS: Filter[] = ['ALL', 'DRAFT', 'IN_REVIEW', 'WON', 'NOT_SELECTED'];

const STATUS_TINT: Record<SubmissionDisplayStatus, string> = {
  WON: 'bg-amber-50 text-amber-600',
  DRAFT: 'bg-mint text-teal',
  IN_REVIEW: 'bg-indigo-50 text-indigo-500',
  NOT_SELECTED: 'bg-neutral-100 text-slate',
};

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

/** Submissions are still accepted while a draft can be finished (FR-SB-04). */
const canStillSubmit = (s: SubmissionView) =>
  s.competition.phase === 'OPEN' || s.competition.phase === 'SUBMISSIONS';

/** US-26 — design/prototype/src/pages/MySubmissionsPage.tsx. */
export default function MySubmissionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useRequireSignIn('/submissions');
  const [filter, setFilter] = useState<Filter>('ALL');
  const summary = useMySubmissionsSummary();
  const q = useMySubmissions(filter === 'ALL' ? undefined : filter);
  const items = flatten(q.data);

  if (!signedIn) return <Loading />;

  const counts = summary.data?.counts;
  const filterLabel = t(`mySubs.filter.${filter}`).toLowerCase();

  const header = (
    <View style={tw`pb-4`}>
      <SummaryStrip
        winnings={summary.data?.totalWinningsPaise ?? 0}
        stats={[
          { label: t('mySubs.entries'), value: counts?.ALL },
          { label: t('mySubs.wins'), value: counts?.WON },
          { label: t('mySubs.inReview'), value: counts?.IN_REVIEW },
        ]}
      />
      <FilterChips
        style={tw`mt-4`}
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ key: f, label: t(`mySubs.filter.${f}`), count: counts?.[f] }))}
      />
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader subtitle={t('mySubs.eyebrow')} title={t('mySubs.title')} />
        <FlashList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <View style={tw`pb-3`}>
              <SubmissionRow s={item} />
            </View>
          )}
          ListHeaderComponent={header}
          contentContainerStyle={tw`px-4 pb-28`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => {
                void q.refetch();
                void summary.refetch();
              }}
              tintColor={color('teal')}
            />
          }
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
          ListEmptyComponent={
            q.isPending ? (
              <Loading />
            ) : q.isError ? (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoNetworkArt />}
                title={t('common.somethingWrong')}
                message={errorMessage(q.error, t)}
                primary={{ label: t('common.retry'), onPress: () => void q.refetch() }}
              />
            ) : filter === 'ALL' ? (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoEntriesArt />}
                title={t('mySubs.emptyAll')}
                message={t('mySubs.emptyAllBody')}
                primary={{ label: t('mySubs.findCompetition'), onPress: () => router.push('/explore') }}
              />
            ) : (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoEntriesArt />}
                title={t('mySubs.emptyFilter', { filter: filterLabel })}
                message={t('mySubs.emptyFilterBody', { filter: filterLabel })}
                primary={{ label: t('mySubs.showAll'), onPress: () => setFilter('ALL') }}
              />
            )
          }
        />
      </View>
      <BottomNav active={null} />
    </SafeAreaView>
  );
}

/** The teal summary strip: total winnings over three counts split by hairlines. */
function SummaryStrip({
  winnings,
  stats,
}: {
  winnings: number;
  stats: { label: string; value: number | undefined }[];
}) {
  const { t } = useTranslation();
  return (
    <Gradient
      dir="br"
      colors={[color('teal'), color('teal-dark')]}
      style={tw`overflow-hidden rounded-2xl p-4 shadow-sm`}
    >
      <View
        style={[
          tw`absolute -right-8 -top-10 w-32 h-32 rounded-full`,
          { backgroundColor: 'rgba(255,255,255,0.1)' },
        ]}
      />
      <View style={tw`flex-row items-center gap-2`}>
        <Trophy color="rgba(255,255,255,0.85)" />
        <T
          style={[
            tw`text-[11px] font-semibold uppercase`,
            { color: 'rgba(255,255,255,0.85)', letterSpacing: 0.275 },
          ]}
        >
          {t('mySubs.totalWinnings')}
        </T>
      </View>
      <T style={tw`mt-1 text-3xl font-extrabold text-white`}>{inr(winnings)}</T>
      <View style={tw`mt-4 flex-row gap-2`}>
        {stats.map((s, i) => (
          <View
            key={s.label}
            style={[
              tw`flex-1 items-center`,
              i < stats.length - 1 && { borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
            ]}
          >
            <T style={tw`text-lg font-extrabold leading-none text-white`}>{s.value ?? '–'}</T>
            <T style={[tw`text-[11px] mt-1`, { color: 'rgba(255,255,255,0.75)' }]}>{s.label}</T>
          </View>
        ))}
      </View>
    </Gradient>
  );
}

function KindIcon({ kind }: { kind: SubmissionView['mediaType'] }) {
  const c = color('teal');
  switch (kind) {
    case 'VIDEO':
      return <Play size={14} color={c} />;
    case 'IMAGE':
      return <Camera size={14} color={c} />;
    case 'AUDIO':
      return <Chat size={14} color={c} />;
    default:
      return <Upload size={14} color={c} />;
  }
}

function SubmissionRow({ s }: { s: SubmissionView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const meta = [s.competition.categoryName, t(`mySubs.kind.${s.mediaType ?? 'none'}`)]
    .filter(Boolean)
    .join(' · ');
  const stamp = s.submittedAt
    ? t('mySubs.submittedAt', { when: formatWhen(s.submittedAt, t) })
    : s.competition.submissionEndsAt
      ? t('mySubs.submitBy', { date: formatShortDate(s.competition.submissionEndsAt) })
      : null;
  const openEntry = () => router.push(`/submission/${s.registrationId}`);

  let footer: ReactNode = null;
  if (s.displayStatus === 'WON' && s.result) {
    footer = (
      <View style={tw`flex-row items-center justify-between bg-amber-50 px-3.5 py-2.5`}>
        <View style={tw`flex-row items-center gap-1.5`}>
          <Trophy color={color('amber-700')} />
          <T style={tw`text-xs font-bold text-amber-700`}>
            {s.result.rank ? t('mySubs.place', { place: ordinal(s.result.rank) }) : t('mySubs.filter.WON')}
          </T>
        </View>
        <T style={tw`text-sm font-extrabold text-amber-700`}>{inr(s.result.prizePaise)}</T>
      </View>
    );
  } else if (s.displayStatus === 'DRAFT') {
    const open = canStillSubmit(s);
    footer = (
      <FooterRow
        text={open ? t('mySubs.draftProgress', { percent: s.checklist.percent }) : t('mySubs.draftClosed')}
        action={open ? t('mySubs.continue') : t('mySubs.view')}
        onAction={openEntry}
      />
    );
  } else if (s.displayStatus === 'IN_REVIEW') {
    footer = <FooterRow text={t('mySubs.locked')} action={t('mySubs.view')} onAction={openEntry} />;
  }

  return (
    <View style={tw`rounded-2xl bg-white shadow-sm overflow-hidden`}>
      <Pressable
        onPress={() => router.push(`/competition/${s.competition.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${s.competition.title}, ${t(`mySubs.filter.${s.displayStatus}`)}`}
        style={({ pressed }) => [tw`flex-row items-start gap-3 w-full p-3`, pressed && tw`bg-neutral-50`]}
      >
        <View style={tw`shrink-0`}>
          <CoverImage uri={s.competition.coverUrl} style={tw`w-16 h-16 rounded-xl`} />
          <View
            style={[
              tw`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white items-center justify-center`,
              ring(1, color('neutral-100'), 'sm'),
            ]}
          >
            <KindIcon kind={s.mediaType} />
          </View>
        </View>
        <View style={tw`flex-1 min-w-0`}>
          <View style={tw`flex-row items-start justify-between gap-2`}>
            <T style={tw`flex-1 font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
              {s.competition.title}
            </T>
            <StatusPill label={t(`mySubs.filter.${s.displayStatus}`)} tint={STATUS_TINT[s.displayStatus]} />
          </View>
          <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
            {meta}
          </T>
          {stamp ? (
            <View style={tw`flex-row items-center gap-1 mt-1.5`}>
              <Clock color={color('slate')} />
              <T style={tw`text-[11px] text-slate`}>{stamp}</T>
            </View>
          ) : null}
        </View>
      </Pressable>
      {footer}
    </View>
  );
}

function FooterRow({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <View style={tw`flex-row items-center justify-between gap-3 border-t border-neutral-100 px-3.5 py-2`}>
      <T style={tw`flex-1 text-[11px] text-slate`} numberOfLines={1}>
        {text}
      </T>
      <Press onPress={onAction} hitSlop={8} accessibilityLabel={action}>
        <T style={tw`text-xs font-bold text-teal`}>{action}</T>
      </Press>
    </View>
  );
}

import type { DisplayPhase, HostedCompetition, HostedFilter } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelCompetition, flatten, useHosted, useHostedSummary } from '@/api/hooks';
import { useRequireSignIn } from '@/auth/session';
import { Loading } from '@/design/loading';
import { BottomNav } from '@/design/bottom-nav';
import {
  BackHeader,
  ConfirmDialog,
  CoverImage,
  FilterChips,
  inr,
  Press,
  StatusPill,
  useToast,
} from '@/design/components';
import { EmptyState, NoEntriesArt, NoNetworkArt } from '@/design/empty';
import { Megaphone, Plus, Trophy, Users } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatShortDate } from '@/lib/format';

type Filter = 'ALL' | HostedFilter;
const FILTERS: Filter[] = ['ALL', 'LIVE', 'JUDGING', 'DRAFT', 'CLOSED'];

/** The design's four buckets, with the real phase named where it says more. */
const STATUS: Partial<Record<DisplayPhase, { key: string; tint: string }>> = {
  DRAFT: { key: 'DRAFT', tint: 'bg-neutral-100 text-slate' },
  AWAITING_FUNDING: { key: 'AWAITING_FUNDING', tint: 'bg-neutral-100 text-slate' },
  UPCOMING: { key: 'UPCOMING', tint: 'bg-mint text-teal' },
  OPEN: { key: 'LIVE', tint: 'bg-mint text-teal' },
  SUBMISSIONS: { key: 'LIVE', tint: 'bg-mint text-teal' },
  JUDGING: { key: 'JUDGING', tint: 'bg-amber-50 text-amber-600' },
  COMPLETED: { key: 'COMPLETED', tint: 'bg-rose-50 text-rose-500' },
  CANCELLED: { key: 'CANCELLED', tint: 'bg-rose-50 text-rose-500' },
};

const isLive = (p: DisplayPhase) => p === 'UPCOMING' || p === 'OPEN' || p === 'SUBMISSIONS';

/** US-16..18 — design/prototype/src/pages/MyCompetitionsPage.tsx. */
export default function MyCompetitionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const signedIn = useRequireSignIn('/my-competitions');
  const [filter, setFilter] = useState<Filter>('ALL');
  const summary = useHostedSummary();
  const q = useHosted(filter === 'ALL' ? undefined : filter);
  const items = flatten(q.data);
  const [cancelling, setCancelling] = useState<HostedCompetition | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  if (!signedIn) return <Loading />;

  const s = summary.data;
  const filterLabel = t(`myComps.filter.${filter}`).toLowerCase();

  // US-17: cancelling refunds every entrant in full and returns the prize pool.
  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await cancelCompetition(cancelling.id);
      showToast(t('myComps.cancelled'));
      for (const key of ['hosted', 'competition', 'home', 'wallet', 'competitions'])
        void qc.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      showToast(errorMessage(e, t));
    } finally {
      setBusy(false);
      setCancelling(null);
    }
  };

  const header = (
    <View style={tw`pb-4`}>
      <View style={tw`flex-row gap-2.5`}>
        <OverviewTile
          tint="bg-mint"
          icon={<Megaphone size={20} color={color('teal')} />}
          value={s ? String(s.counts.LIVE) : '–'}
          label={t('myComps.liveNow')}
        />
        <OverviewTile
          tint="bg-indigo-50"
          icon={<Users color={color('indigo-500')} />}
          value={s ? s.totalEntries.toLocaleString('en-IN') : '–'}
          label={t('myComps.totalEntries')}
        />
        <OverviewTile
          tint="bg-amber-50"
          icon={<Trophy size={20} color={color('amber-600')} />}
          value={s ? inr(s.revenuePaise) : '–'}
          label={t('myComps.revenue')}
        />
      </View>
      <FilterChips
        style={tw`mt-4`}
        tone="ink"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ key: f, label: t(`myComps.filter.${f}`), count: s?.counts[f] }))}
      />
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader
          subtitle={t('myComps.eyebrow')}
          title={t('myComps.title')}
          right={
            <Press
              onPress={() => router.push('/host')}
              scale={0.95}
              accessibilityLabel={t('design.hostAction')}
              style={tw`flex-row items-center gap-1 rounded-full bg-teal pl-2.5 pr-3.5 py-2 shadow-sm`}
            >
              <Plus color="#fff" />
              <T style={tw`text-xs font-bold text-white`}>{t('myComps.new')}</T>
            </Press>
          }
        />
        <FlashList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <View style={tw`pb-3`}>
              <HostedCard c={item} onCancel={() => setCancelling(item)} />
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
                title={t('myComps.emptyAll')}
                message={t('myComps.emptyAllBody')}
                primary={{ label: t('myComps.hostOne'), onPress: () => router.push('/host') }}
              />
            ) : (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoEntriesArt />}
                title={t('myComps.emptyFilter', { filter: filterLabel })}
                message={t('myComps.emptyFilterBody', { filter: filterLabel })}
                primary={{ label: t('myComps.showAll'), onPress: () => setFilter('ALL') }}
              />
            )
          }
        />
        {toast}
      </View>
      <BottomNav active={null} />
      <ConfirmDialog
        open={!!cancelling}
        title={t('myComps.cancelTitle')}
        message={t('myComps.cancelBody', { title: cancelling?.title ?? '' })}
        cancel={t('myComps.keep')}
        confirm={t('myComps.cancelIt')}
        busy={busy}
        onConfirm={() => void cancel()}
        onClose={() => !busy && setCancelling(null)}
      />
    </SafeAreaView>
  );
}

/** Overview tile: `rounded-2xl bg-white shadow-sm p-3` with a tinted icon square. */
function OverviewTile({
  tint,
  icon,
  value,
  label,
}: {
  tint: string;
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={tw`flex-1 min-w-0 rounded-2xl bg-white shadow-sm p-3`}>
      <View style={tw`w-8 h-8 rounded-lg items-center justify-center ${tint}`}>{icon}</View>
      <T style={tw`mt-2 text-base font-extrabold text-ink leading-none`} numberOfLines={1}>
        {value}
      </T>
      <T style={tw`text-[11px] text-slate mt-1`}>{label}</T>
    </View>
  );
}

type Action = {
  label: string;
  kind: 'outline' | 'primary' | 'amber' | 'danger';
  grow?: boolean;
  to?: Href;
  onPress?: () => void;
};

function HostedCard({ c, onCancel }: { c: HostedCompetition; onCancel: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const status = STATUS[c.phase] ?? STATUS.DRAFT!;
  const detail: Href = `/competition/${c.id}`;
  const created = formatShortDate(c.createdAt);

  let actions: Action[];
  if (c.phase === 'DRAFT' || c.phase === 'AWAITING_FUNDING') {
    actions = [
      {
        label: t('myComps.editDraft'),
        kind: 'outline',
        grow: true,
        to: { pathname: '/host', params: { id: c.id } },
      },
      {
        label: t('myComps.publish'),
        kind: 'primary',
        grow: true,
        to: { pathname: '/host', params: { id: c.id, step: 'REVIEW' } },
      },
    ];
  } else if (isLive(c.phase)) {
    actions = [
      { label: t('myComps.view'), kind: 'outline', grow: true, to: detail },
      // FR-HS-08: details stay editable only until the first registration.
      ...(c.registrations === 0 && c.phase !== 'SUBMISSIONS'
        ? [
            {
              label: t('myComps.edit'),
              kind: 'outline' as const,
              to: { pathname: '/host', params: { id: c.id } } as Href,
            },
          ]
        : []),
      { label: t('myComps.cancel'), kind: 'danger', onPress: onCancel },
    ];
  } else if (c.phase === 'JUDGING') {
    actions = [
      { label: t('myComps.view'), kind: 'outline', grow: true, to: detail },
      { label: t('myComps.scorePublish'), kind: 'amber', grow: true, to: `/competition/${c.id}/judge` },
    ];
  } else if (c.phase === 'COMPLETED') {
    actions = [
      { label: t('myComps.view'), kind: 'outline', grow: true, to: detail },
      { label: t('myComps.results'), kind: 'outline', grow: true, to: `/competition/${c.id}/leaderboard` },
    ];
  } else {
    actions = [{ label: t('myComps.view'), kind: 'outline', grow: true, to: detail }];
  }

  return (
    <View style={tw`rounded-2xl bg-white shadow-sm overflow-hidden`}>
      <View style={tw`flex-row items-start gap-3 p-3`}>
        <CoverImage uri={c.coverUrl} style={tw`w-16 h-16 rounded-xl shrink-0`} />
        <View style={tw`flex-1 min-w-0`}>
          <View style={tw`flex-row items-start justify-between gap-2`}>
            <T style={tw`flex-1 font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
              {c.title}
            </T>
            <StatusPill label={t(`myComps.status.${status.key}`)} tint={status.tint} />
          </View>
          <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
            {c.category
              ? t('myComps.created', { category: c.category.name, date: created })
              : t('myComps.createdNoCategory', { date: created })}
          </T>
          <View style={tw`flex-row items-center gap-3 mt-1.5`}>
            <View style={tw`flex-row items-center gap-1`}>
              <Users color={color('slate')} />
              <T style={tw`text-[11px] text-slate`}>{c.registrations.toLocaleString('en-IN')}</T>
            </View>
            <T style={tw`text-[11px] text-slate`}>{t('myComps.submitted', { count: c.submissions })}</T>
            <T style={tw`text-[11px] text-teal font-semibold`}>{inr(c.entryRevenuePaise)}</T>
          </View>
        </View>
      </View>

      {c.overdue ? (
        <View style={tw`flex-row items-center gap-1.5 bg-amber-50 px-3.5 py-2`}>
          <Trophy color={color('amber-700')} />
          <T style={tw`text-xs font-semibold text-amber-700`}>{t('myComps.overdue')}</T>
        </View>
      ) : null}

      <View style={tw`flex-row items-center gap-2 border-t border-neutral-100 px-3 py-2.5`}>
        {actions.map((a) => (
          <Press
            key={a.label}
            onPress={a.onPress ?? (() => a.to && router.push(a.to))}
            style={[
              tw`rounded-lg py-2 items-center`,
              a.grow ? tw`flex-1` : tw`px-3`,
              a.kind === 'outline' && [tw`bg-white`, ring(1, color('neutral-200'))],
              a.kind === 'primary' && tw`bg-teal`,
              a.kind === 'amber' && tw`bg-amber-500`,
              a.kind === 'danger' && tw`bg-rose-50`,
            ]}
          >
            <T
              style={tw`text-xs font-bold ${
                a.kind === 'outline' ? 'text-ink' : a.kind === 'danger' ? 'text-rose-500' : 'text-white'
              }`}
            >
              {a.label}
            </T>
          </Press>
        ))}
      </View>
    </View>
  );
}

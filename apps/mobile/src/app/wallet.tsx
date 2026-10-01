import type { LedgerKind, WalletTransaction } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useUserStats, useWallet, useWalletHistory } from '@/api/hooks';
import { useRequireSignIn, useSession } from '@/auth/session';
import { Loading } from '@/design/loading';
import { BottomNav } from '@/design/bottom-nav';
import { BackHeader, FilterChips, inr, Press } from '@/design/components';
import { EmptyState, NoEntriesArt, NoNetworkArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Eye,
  EyeOff,
  Megaphone,
  Search,
  Shield,
  Star,
  Trophy,
  Upload,
} from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { errorMessage, formatWhen } from '@/lib/format';

type Filter = 'all' | 'earnings' | 'entries' | 'refunds';
const FILTERS: Filter[] = ['all', 'earnings', 'entries', 'refunds'];

/** WalletPage kindMeta, for the ledger's kinds: money in is mint, money out neutral. */
const KIND: Record<LedgerKind, { icon: (c: string) => ReactNode; tint: string; fg: string }> = {
  PRIZE: { icon: (c) => <Trophy color={c} />, tint: 'bg-mint', fg: 'teal' },
  HOST_REVENUE: { icon: (c) => <ArrowDownLeft size={18} color={c} />, tint: 'bg-mint', fg: 'teal' },
  REFUND: { icon: (c) => <ArrowDownLeft size={18} color={c} />, tint: 'bg-mint', fg: 'teal' },
  UNAWARDED_RETURN: { icon: (c) => <ArrowDownLeft size={18} color={c} />, tint: 'bg-mint', fg: 'teal' },
  ESCROW_RETURN: { icon: (c) => <ArrowDownLeft size={18} color={c} />, tint: 'bg-mint', fg: 'teal' },
  ENTRY_FEE: { icon: (c) => <ArrowUpRight size={18} color={c} />, tint: 'bg-neutral-100', fg: 'slate' },
  PRIZE_FUNDING: {
    icon: (c) => <ArrowUpRight size={18} color={c} />,
    tint: 'bg-indigo-50',
    fg: 'indigo-500',
  },
};

type Group = 'today' | 'week' | 'earlier';
type Section = { group: Group; items: WalletTransaction[] };

/** US-30 — design/prototype/src/pages/WalletPage.tsx. */
export default function WalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useRequireSignIn('/wallet');
  const user = useSession((s) => s.user);
  const [filter, setFilter] = useState<Filter>('all');
  const [hidden, setHidden] = useState(false);
  const wallet = useWallet();
  const stats = useUserStats(user?.id);
  const history = useWalletHistory(filter);

  if (!signedIn) return <Loading />;

  const sections = groupByAge(flatten(history.data));
  const money = (paise: number | undefined, mask = '₹ ••••') =>
    hidden ? mask : paise === undefined ? '—' : inr(paise);

  // The design's Withdraw / Add money / Send / Rewards are out of scope; the same row
  // leads to the places money moves from (real routes).
  const quick: { label: string; icon: ReactNode; to: Href }[] = [
    { label: t('walletUi.entries'), icon: <Upload size={22} color={color('teal')} />, to: '/submissions' },
    {
      label: t('walletUi.hosting'),
      icon: <Megaphone size={22} color={color('teal')} />,
      to: '/my-competitions',
    },
    { label: t('walletUi.explore'), icon: <Search size={22} color={color('teal')} />, to: '/explore' },
    { label: t('walletUi.alerts'), icon: <Bell size={22} color={color('teal')} />, to: '/notifications' },
  ];

  const header = (
    <View style={tw`pb-4`}>
      {/* Balance card — payment-card styling */}
      <Gradient
        dir="br"
        colors={['#0d8074', color('teal'), '#155e56']}
        style={[tw`overflow-hidden rounded-3xl p-5`, { boxShadow: '0 16px 40px -12px rgba(13,128,116,0.6)' }]}
      >
        <View
          style={[
            tw`absolute -right-10 -top-12 h-40 w-40 rounded-full`,
            { backgroundColor: 'rgba(255,255,255,0.1)' },
          ]}
        />
        <View
          style={[
            tw`absolute right-10 h-28 w-28 rounded-full`,
            { bottom: -40, backgroundColor: 'rgba(255,255,255,0.05)' },
          ]}
        />
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center gap-2`}>
            <View
              style={[
                tw`h-8 w-8 items-center justify-center rounded-lg`,
                { backgroundColor: 'rgba(255,255,255,0.15)' },
              ]}
            >
              <Trophy color="#fff" />
            </View>
            <T style={[tw`text-sm font-semibold text-white`, { letterSpacing: 0.35 }]}>
              {t('walletUi.brand')}
            </T>
          </View>
          <View style={[tw`rounded-full px-2.5 py-1`, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <T style={[tw`text-[10px] font-bold uppercase text-white`, { letterSpacing: 1 }]}>
              {wallet.data?.currency ?? 'INR'}
            </T>
          </View>
        </View>

        <View style={tw`mt-6`}>
          <T style={[tw`text-xs`, { color: 'rgba(255,255,255,0.75)' }]}>{t('wallet.balance')}</T>
          <View style={tw`mt-1 flex-row items-center gap-3`}>
            <T
              style={[
                tw`text-4xl font-extrabold text-white`,
                { letterSpacing: -0.9, fontVariant: ['tabular-nums'] },
              ]}
              accessibilityLiveRegion="polite"
            >
              {money(wallet.data?.balancePaise, '₹ ••••••')}
            </T>
            <Press
              onPress={() => setHidden((v) => !v)}
              accessibilityLabel={hidden ? t('walletUi.show') : t('walletUi.hide')}
              scale={0.9}
              hitSlop={8}
            >
              {hidden ? <EyeOff color="rgba(255,255,255,0.8)" /> : <Eye color="rgba(255,255,255,0.8)" />}
            </Press>
          </View>
        </View>

        <View
          style={[
            tw`mt-5 flex-row items-center justify-between gap-3 border-t pt-4`,
            { borderColor: 'rgba(255,255,255,0.15)' },
          ]}
        >
          <T
            style={[tw`flex-1 text-sm`, { color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }]}
            numberOfLines={1}
          >
            {user?.email ?? ''}
          </T>
          <T style={[tw`text-xs font-semibold`, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
            {user?.displayName ?? ''}
          </T>
        </View>
      </Gradient>

      {/* Quick actions */}
      <View style={tw`mt-5 flex-row items-start justify-between px-1`}>
        {quick.map((a) => (
          <Press
            key={a.label}
            onPress={() => router.push(a.to)}
            scale={0.95}
            accessibilityLabel={a.label}
            style={tw`flex-1 items-center gap-2`}
          >
            <View style={tw`h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm`}>
              {a.icon}
            </View>
            <T style={tw`text-[11px] font-semibold text-ink`}>{a.label}</T>
          </Press>
        ))}
      </View>

      {/* Earnings summary */}
      <View style={tw`mt-5 flex-row gap-3`}>
        <SummaryTile
          tint="bg-mint"
          icon={<Trophy color={color('teal')} />}
          value={money(wallet.data?.totalWinningsPaise)}
          label={t('wallet.winnings')}
        />
        <SummaryTile
          tint="bg-amber-50"
          icon={<Star size={18} color={color('amber-600')} />}
          value={stats.data ? String(stats.data.won) : '—'}
          label={t('walletUi.prizesWon')}
        />
      </View>

      {/* Note */}
      <View
        style={[
          tw`mt-3 flex-row items-center gap-2 rounded-2xl px-4 py-2.5`,
          { backgroundColor: 'rgba(232,245,241,0.6)' },
        ]}
      >
        <Shield color={color('teal')} />
        <T style={tw`flex-1 text-xs font-medium text-teal`}>{t('wallet.later')}</T>
      </View>
      {wallet.isError ? <T style={tw`mt-2 text-xs text-rose-500`}>{errorMessage(wallet.error, t)}</T> : null}

      {/* Transactions */}
      <T style={tw`mt-6 font-bold text-ink`} accessibilityRole="header">
        {t('walletUi.transactions')}
      </T>
      <FilterChips
        style={tw`mt-3`}
        tone="ink"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ key: f, label: t(`wallet.filters.${f}`) }))}
      />
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader title={t('wallet.title')} />
        <FlashList
          data={sections}
          keyExtractor={(s) => s.group}
          renderItem={({ item }) => (
            <View style={tw`pb-5`}>
              <T style={[tw`mb-2 px-1 text-[11px] font-bold uppercase text-slate`, { letterSpacing: 0.275 }]}>
                {t(`walletUi.group.${item.group}`)}
              </T>
              <View style={tw`rounded-2xl bg-white shadow-sm`}>
                {item.items.map((tx, i) => (
                  <TxRow key={tx.id} tx={tx} hidden={hidden} first={i === 0} />
                ))}
              </View>
            </View>
          )}
          ListHeaderComponent={header}
          contentContainerStyle={tw`px-4 pb-28`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching}
              onRefresh={() => {
                void wallet.refetch();
                void history.refetch();
              }}
              tintColor={color('teal')}
            />
          }
          onEndReached={() =>
            history.hasNextPage && !history.isFetchingNextPage && void history.fetchNextPage()
          }
          onEndReachedThreshold={0.5}
          ListFooterComponent={history.isFetchingNextPage ? <Loading /> : null}
          ListEmptyComponent={
            history.isPending ? (
              <Loading />
            ) : history.isError ? (
              <EmptyState
                style={tw`py-10`}
                illustration={<NoNetworkArt />}
                title={t('common.somethingWrong')}
                message={errorMessage(history.error, t)}
                primary={{ label: t('common.retry'), onPress: () => void history.refetch() }}
              />
            ) : filter === 'all' ? (
              <EmptyState
                style={tw`py-10`}
                illustration={<NoEntriesArt />}
                title={t('wallet.empty')}
                message={t('walletUi.emptyBody')}
                primary={{ label: t('mySubs.findCompetition'), onPress: () => router.push('/explore') }}
              />
            ) : (
              <T style={tw`py-10 text-center text-sm text-slate`}>{t('walletUi.emptyFilter')}</T>
            )
          }
        />
      </View>
      <BottomNav active="profile" />
    </SafeAreaView>
  );
}

function SummaryTile({
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
    <View style={tw`flex-1 rounded-2xl bg-white p-4 shadow-sm`}>
      <View style={tw`h-9 w-9 items-center justify-center rounded-xl ${tint}`}>{icon}</View>
      <T
        style={[tw`mt-2.5 text-xl font-extrabold text-ink leading-none`, { fontVariant: ['tabular-nums'] }]}
        numberOfLines={1}
      >
        {value}
      </T>
      <T style={tw`mt-1 text-[11px] text-slate`}>{label}</T>
    </View>
  );
}

function TxRow({ tx, hidden, first }: { tx: WalletTransaction; hidden: boolean; first: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const meta = KIND[tx.kind];
  const credit = tx.amountPaise > 0;
  const amount = `${credit ? '+ ' : '− '}${hidden ? '••••' : inr(Math.abs(tx.amountPaise))}`;
  // Older ledger lines say only "Entry fee"; don't repeat the kind under them.
  const kind = t(`walletUi.kind.${tx.kind}`);
  const sub = [
    tx.description.startsWith(kind) ? null : kind,
    formatWhen(tx.createdAt, t),
    // Card payments and card refunds never touched the wallet balance.
    tx.affectsBalance ? null : t('wallet.byCard'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={tx.competitionId ? () => router.push(`/competition/${tx.competitionId}`) : undefined}
      disabled={!tx.competitionId}
      accessibilityRole={tx.competitionId ? 'button' : undefined}
      accessibilityLabel={`${tx.description}, ${amount}`}
      style={tw`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-neutral-100'}`}
    >
      <View style={tw`h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}>
        {meta.icon(color(meta.fg))}
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <T style={tw`text-sm font-bold text-ink leading-tight`} numberOfLines={1}>
          {tx.description}
        </T>
        <T style={tw`text-[11px] text-slate`} numberOfLines={1}>
          {sub}
        </T>
      </View>
      <T
        style={[
          tw`shrink-0 text-sm font-extrabold ${credit ? 'text-teal' : 'text-ink'}`,
          { fontVariant: ['tabular-nums'] },
        ]}
      >
        {amount}
      </T>
    </Pressable>
  );
}

/** Rows arrive newest first: Today, This week (the six days before), Earlier. */
function groupByAge(items: WalletTransaction[]): Section[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = today - 6 * 86_400_000;
  const out: Section[] = [];
  for (const tx of items) {
    const at = new Date(tx.createdAt).getTime();
    const group: Group = at >= today ? 'today' : at >= weekAgo ? 'week' : 'earlier';
    const last = out.at(-1);
    if (last?.group === group) last.items.push(tx);
    else out.push({ group, items: [tx] });
  }
  return out;
}

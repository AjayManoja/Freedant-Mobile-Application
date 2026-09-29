import { Ionicons } from '@expo/vector-icons';
import type { LedgerKind, WalletTransaction } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useWallet, useWalletHistory } from '@/api/hooks';
import { useRequireSignIn } from '@/auth/session';
import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  type IconName,
  Loading,
  Notice,
} from '@/components/ui';
import { errorMessage, formatDate, formatInr } from '@/lib/format';
import { appMaxWidth, colors, radius, shadow, space } from '@/theme/tokens';

type Filter = 'all' | 'earnings' | 'entries' | 'refunds';
const FILTERS: Filter[] = ['all', 'earnings', 'entries', 'refunds'];

const kindIcon: Record<LedgerKind, IconName> = {
  ENTRY_FEE: 'ticket-outline',
  PRIZE_FUNDING: 'megaphone-outline',
  REFUND: 'return-down-back-outline',
  PRIZE: 'trophy-outline',
  HOST_REVENUE: 'cash-outline',
  UNAWARDED_RETURN: 'arrow-undo-outline',
  ESCROW_RETURN: 'arrow-undo-outline',
};

type Row = { kind: 'day'; label: string } | { kind: 'tx'; tx: WalletTransaction };

/** US-30: balance, total winnings and a filterable history grouped by day. */
export default function WalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useRequireSignIn('/wallet');
  const [filter, setFilter] = useState<Filter>('all');
  const wallet = useWallet();
  const history = useWalletHistory(filter);

  if (!signedIn) return <Loading />;

  const rows = groupByDay(flatten(history.data), t('common.today'), t('common.yesterday'));

  const header = (
    <View style={styles.header}>
      <Header title={t('wallet.title')} onBack={() => router.back()} />
      <View style={styles.balance}>
        <AppText variant="caption" color={colors.mint}>
          {t('wallet.balance')}
        </AppText>
        <AppText variant="display" color={colors.white} accessibilityLiveRegion="polite">
          {wallet.data ? formatInr(wallet.data.balancePaise) : '—'}
        </AppText>
        <View style={styles.divider} />
        <View style={styles.inline}>
          <Ionicons name="trophy-outline" size={16} color={colors.mint} />
          <AppText variant="bodyStrong" color={colors.white}>
            {t('wallet.winnings')} · {wallet.data ? formatInr(wallet.data.totalWinningsPaise) : '—'}
          </AppText>
        </View>
      </View>
      {wallet.isError ? (
        <Notice tone="danger" icon="alert-circle-outline" text={errorMessage(wallet.error, t)} />
      ) : null}
      <AppText variant="caption">{t('wallet.later')}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`wallet.filters.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.column}>
        <FlashList
          data={rows}
          keyExtractor={(r) => (r.kind === 'day' ? `d-${r.label}` : r.tx.id)}
          getItemType={(r) => r.kind}
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <AppText variant="label" style={styles.day} accessibilityRole="header">
                {item.label}
              </AppText>
            ) : (
              <TxRow
                tx={item.tx}
                onPress={
                  item.tx.competitionId
                    ? () => router.push(`/competition/${item.tx.competitionId}`)
                    : undefined
                }
              />
            )
          }
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching}
              onRefresh={() => {
                void wallet.refetch();
                void history.refetch();
              }}
              tintColor={colors.teal}
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
              <ErrorState message={errorMessage(history.error, t)} onRetry={() => void history.refetch()} />
            ) : (
              <EmptyState icon="wallet-outline" text={t('wallet.empty')} />
            )
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
}

function TxRow({ tx, onPress }: { tx: WalletTransaction; onPress?: () => void }) {
  const { t } = useTranslation();
  const incoming = tx.amountPaise > 0;
  const amount = `${incoming ? '+' : '−'}${formatInr(Math.abs(tx.amountPaise))}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${tx.description}, ${amount}`}
      style={({ pressed }) => [styles.tx, pressed && styles.pressed]}
    >
      <View style={[styles.txIcon, incoming && styles.txIconIn]}>
        <Ionicons name={kindIcon[tx.kind]} size={18} color={incoming ? colors.success : colors.slateStrong} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {tx.description}
        </AppText>
        {/* Card payments and card refunds never touched the wallet balance. */}
        {!tx.affectsBalance ? <AppText variant="caption">{t('wallet.byCard')}</AppText> : null}
      </View>
      <AppText variant="bodyStrong" color={incoming ? colors.success : colors.ink}>
        {amount}
      </AppText>
    </Pressable>
  );
}

/** Rows arrive newest first, so a new day header is inserted whenever the local date changes. */
function groupByDay(items: WalletTransaction[], today: string, yesterday: string): Row[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const now = new Date();
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const rows: Row[] = [];
  let last: string | null = null;
  for (const tx of items) {
    const key = dayKey(new Date(tx.createdAt));
    if (key !== last) {
      rows.push({
        kind: 'day',
        label: key === todayKey ? today : key === yesterdayKey ? yesterday : formatDate(tx.createdAt),
      });
      last = key;
    }
    rows.push({ kind: 'tx', tx });
  }
  return rows;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  column: { flex: 1, width: '100%', maxWidth: appMaxWidth, alignSelf: 'center', paddingHorizontal: space.lg },
  listContent: { paddingBottom: 40 },
  header: { gap: space.md, paddingTop: space.md, paddingBottom: space.sm },
  balance: { backgroundColor: colors.teal, borderRadius: radius.xl, padding: space.xl, gap: space.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: space.sm,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  day: { paddingTop: space.md, paddingBottom: space.sm },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    ...shadow,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconIn: { backgroundColor: colors.successTint },
  flex: { flex: 1 },
  pressed: { opacity: 0.88 },
});

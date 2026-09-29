import { Ionicons } from '@expo/vector-icons';
import type { HostedCompetition, SubmissionDisplayStatus, SubmissionView } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelCompetition, flatten, useHosted, useMySubmissions } from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import { Cover, PhaseBadge, SubmissionBadge } from '@/components/competition';
import {
  AppText,
  Badge,
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Header,
  Loading,
  Notice,
  ProgressBar,
  Row,
  SectionHeader,
  Segmented,
} from '@/components/ui';
import { errorMessage, formatInr } from '@/lib/format';
import { appMaxWidth, colors, radius, shadow, space } from '@/theme/tokens';

type Tab = 'entered' | 'hosting';
const STATUSES: SubmissionDisplayStatus[] = ['DRAFT', 'IN_REVIEW', 'WON', 'NOT_SELECTED'];

/** US-18 (hosting dashboard) and US-26 (my submissions). */
export default function MyCompetitions() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const status = useSession((s) => s.status);
  const [tab, setTab] = useState<Tab>(params.tab === 'hosting' ? 'hosting' : 'entered');

  if (status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.column}>
          <Header title={t('competitions.title')} />
          <EmptyState
            icon="trophy-outline"
            text={t('competitions.signIn')}
            action={t('profile.signIn')}
            onAction={() => requireSignIn('/competitions')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const header = (
    <View style={styles.header}>
      <Header title={t('competitions.title')} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'entered', label: t('competitions.entered') },
          { value: 'hosting', label: t('competitions.hosting') },
        ]}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.column}>
        {tab === 'entered' ? <Entered header={header} /> : <Hosting header={header} />}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- entered (US-26)

function Entered({ header }: { header: ReactElement }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<SubmissionDisplayStatus | undefined>();
  const q = useMySubmissions(filter);
  const items = flatten(q.data);

  return (
    <FlashList
      data={items}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <SubmissionCard s={item} />}
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          {header}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label={t('competitions.all')} selected={!filter} onPress={() => setFilter(undefined)} />
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={t(`competitions.status.${s}`)}
                selected={filter === s}
                onPress={() => setFilter(s)}
              />
            ))}
          </ScrollView>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.teal}
        />
      }
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
      ListEmptyComponent={
        q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState message={errorMessage(q.error, t)} onRetry={() => void q.refetch()} />
        ) : (
          <EmptyState
            icon="cloud-upload-outline"
            text={t('competitions.noEntries')}
            action={t('tabs.explore')}
            onAction={() => router.push('/explore')}
          />
        )
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

function SubmissionCard({ s }: { s: SubmissionView }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.item}>
      <Pressable
        onPress={() => router.push(`/submission/${s.registrationId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${s.competition.title}, ${t(`competitions.status.${s.displayStatus}`)}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Row>
          <Cover uri={s.competition.coverUrl} size={56} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {s.competition.title}
            </AppText>
            <Row style={styles.wrap}>
              <SubmissionBadge status={s.displayStatus} />
              <PhaseBadge phase={s.competition.phase} />
            </Row>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.slate} />
        </Row>
        {s.displayStatus === 'DRAFT' ? (
          <>
            <AppText variant="caption">{t('submission.checklist', { percent: s.checklist.percent })}</AppText>
            <ProgressBar value={s.checklist.percent / 100} />
          </>
        ) : null}
        {s.result?.rank ? (
          <AppText variant="bodyStrong" color={s.result.prizePaise > 0 ? colors.success : colors.ink}>
            {t('submission.result', { rank: s.result.rank, score: s.result.score ?? '—' })}
            {s.result.prizePaise > 0
              ? ` · ${t('submission.prize', { amount: formatInr(s.result.prizePaise) })}`
              : ''}
          </AppText>
        ) : null}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- hosting (US-16, US-17, US-18)

type HostRow = { kind: 'section'; title: string } | { kind: 'item'; c: HostedCompetition };

function Hosting({ header }: { header: ReactElement }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useHosted();
  const [cancelling, setCancelling] = useState<HostedCompetition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = flatten(q.data);
  const drafts = all.filter((c) => c.status === 'DRAFT' || c.status === 'AWAITING_FUNDING');
  const rest = all.filter((c) => c.status !== 'DRAFT' && c.status !== 'AWAITING_FUNDING');
  const rows: HostRow[] = [
    ...(drafts.length ? [{ kind: 'section' as const, title: t('competitions.drafts') }] : []),
    ...drafts.map((c) => ({ kind: 'item' as const, c })),
    ...(drafts.length && rest.length ? [{ kind: 'section' as const, title: t('competitions.hosting') }] : []),
    ...rest.map((c) => ({ kind: 'item' as const, c })),
  ];

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    setError(null);
    try {
      await cancelCompetition(cancelling.id);
      setCancelling(null);
      void qc.invalidateQueries({ queryKey: ['hosted'] });
      void qc.invalidateQueries({ queryKey: ['competition', cancelling.id] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['wallet'] });
    } catch (e) {
      setError(errorMessage(e, t));
      setCancelling(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <FlashList
        data={rows}
        keyExtractor={(r) => (r.kind === 'section' ? `s-${r.title}` : r.c.id)}
        getItemType={(r) => r.kind}
        renderItem={({ item }) =>
          item.kind === 'section' ? (
            <View style={styles.item}>
              <SectionHeader title={item.title} />
            </View>
          ) : (
            <HostedCard c={item.c} onCancel={() => setCancelling(item.c)} />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {header}
            {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.teal}
          />
        }
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <ErrorState message={errorMessage(q.error, t)} onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState
              icon="megaphone-outline"
              text={t('competitions.noHosted')}
              action={t('create.host')}
              onAction={() => router.push('/host')}
            />
          )
        }
        contentContainerStyle={styles.listContent}
      />
      <ConfirmSheet
        visible={!!cancelling}
        title={t('competitions.cancel')}
        message={t('competitions.cancelConfirm')}
        confirm={t('competitions.cancel')}
        danger
        busy={busy}
        onConfirm={() => void cancel()}
        onClose={() => setCancelling(null)}
      />
    </>
  );
}

function HostedCard({ c, onCancel }: { c: HostedCompetition; onCancel: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = c.status === 'DRAFT' || c.status === 'AWAITING_FUNDING';
  // FR-HS-08: details stay editable only until the first registration.
  const editable =
    c.status === 'PUBLISHED' && c.registrations === 0 && (c.phase === 'UPCOMING' || c.phase === 'OPEN');
  const cancellable = c.status === 'PUBLISHED';

  return (
    <View style={styles.item}>
      <View style={styles.card}>
        <Pressable
          onPress={() =>
            draft
              ? router.push({ pathname: '/host', params: { id: c.id } })
              : router.push(`/competition/${c.id}`)
          }
          accessibilityRole="button"
          accessibilityLabel={c.title}
          style={({ pressed }) => [styles.gap, pressed && styles.pressed]}
        >
          <Row>
            <Cover uri={c.coverUrl} size={56} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {c.title}
              </AppText>
              <Row style={styles.wrap}>
                <PhaseBadge phase={c.phase} />
                {c.overdue ? (
                  <Badge label={t('competitions.overdue')} tone="danger" icon="alarm-outline" />
                ) : null}
              </Row>
            </View>
            <AppText variant="heading" color={colors.teal}>
              {formatInr(c.prizePoolPaise)}
            </AppText>
          </Row>
          {!draft ? (
            <Row style={styles.stats}>
              <Stat
                icon="people-outline"
                text={t('competitions.registrations', { count: c.registrations })}
              />
              <Stat
                icon="cloud-upload-outline"
                text={t('competitions.submissions', { count: c.submissions })}
              />
            </Row>
          ) : null}
          {!draft && c.entryFeePaise > 0 ? (
            <AppText variant="caption">
              {t('competitions.revenue', { amount: formatInr(c.entryRevenuePaise) })}
            </AppText>
          ) : null}
        </Pressable>

        <Row style={styles.wrap}>
          {draft ? (
            <Button
              title={t('competitions.resume')}
              kind="secondary"
              icon="create-outline"
              onPress={() => router.push({ pathname: '/host', params: { id: c.id } })}
            />
          ) : null}
          {editable ? (
            <Button
              title={t('common.edit')}
              kind="secondary"
              icon="create-outline"
              onPress={() => router.push({ pathname: '/host', params: { id: c.id } })}
            />
          ) : null}
          {c.phase === 'JUDGING' ? (
            <Button
              title={t('competitions.judge')}
              icon="ribbon-outline"
              onPress={() => router.push(`/competition/${c.id}/judge`)}
            />
          ) : null}
          {c.phase === 'COMPLETED' ? (
            <Button
              title={t('competitions.results')}
              kind="secondary"
              icon="podium-outline"
              onPress={() => router.push(`/competition/${c.id}/leaderboard`)}
            />
          ) : null}
          {cancellable ? <Button title={t('competitions.cancel')} kind="ghost" onPress={onCancel} /> : null}
        </Row>
      </View>
    </View>
  );
}

const Stat = ({ icon, text }: { icon: 'people-outline' | 'cloud-upload-outline'; text: string }) => (
  <Row>
    <Ionicons name={icon} size={14} color={colors.slateStrong} />
    <AppText variant="caption">{text}</AppText>
  </Row>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  column: { flex: 1, width: '100%', maxWidth: appMaxWidth, alignSelf: 'center', paddingHorizontal: space.lg },
  listContent: { paddingBottom: 40 },
  header: { gap: space.md },
  headerWrap: { gap: space.md, paddingTop: space.md, paddingBottom: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  item: { paddingBottom: space.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    ...shadow,
  },
  pressed: { opacity: 0.88 },
  flex: { flex: 1, gap: 4 },
  gap: { gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  stats: { gap: space.lg },
});

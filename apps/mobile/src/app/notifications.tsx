import type { NotificationTarget, NotificationType, NotificationView } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useMarkRead, useNotifications, useUnreadCount } from '@/api/hooks';
import { useRequireSignIn } from '@/auth/session';
import { Loading } from '@/design/loading';
import { BottomNav } from '@/design/bottom-nav';
import { EmptyState, NoNetworkArt, NoResultsArt } from '@/design/empty';
import { ArrowDownLeft, ArrowLeft, CheckCircle, Fire, Info, Megaphone, Trophy } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatAgo } from '@/lib/format';

/** NotificationsPage tints, per notification type. */
const TYPE: Record<NotificationType, { tint: string; fg: string; icon: (c: string) => ReactNode }> = {
  RESULTS_PUBLISHED: { tint: 'bg-amber-50', fg: 'amber-500', icon: (c) => <Trophy size={20} color={c} /> },
  PRIZE_WON: { tint: 'bg-amber-50', fg: 'amber-500', icon: (c) => <Trophy size={20} color={c} /> },
  REGISTRATION_OPENED: { tint: 'bg-mint', fg: 'teal', icon: (c) => <Fire size={20} color={c} /> },
  COMPETITION_PUBLISHED: {
    tint: 'bg-indigo-50',
    fg: 'indigo-400',
    icon: (c) => <Megaphone size={20} color={c} />,
  },
  REGISTRATION_CONFIRMED: { tint: 'bg-mint', fg: 'teal', icon: (c) => <CheckCircle color={c} /> },
  REFUND_ISSUED: { tint: 'bg-neutral-100', fg: 'slate', icon: (c) => <ArrowDownLeft size={18} color={c} /> },
  PAYMENT_FAILED: { tint: 'bg-rose-50', fg: 'rose-400', icon: (c) => <Info color={c} /> },
  COMPETITION_CANCELLED: { tint: 'bg-rose-50', fg: 'rose-400', icon: (c) => <Info color={c} /> },
};

/** FR-NT-03: where tapping a notification leads. */
function hrefFor(target: NotificationTarget): Href {
  switch (target.screen) {
    case 'competition':
      return `/competition/${target.competitionId}`;
    case 'leaderboard':
      return `/competition/${target.competitionId}/leaderboard`;
    case 'wallet':
      return '/wallet';
    case 'my-competitions':
      return '/my-competitions';
  }
}

type Row = { kind: 'group'; label: string } | { kind: 'note'; n: NotificationView };

/** US-32, US-33 — design/prototype/src/pages/NotificationsPage.tsx. */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useRequireSignIn('/notifications');
  const q = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkRead();

  if (!signedIn) return <Loading />;

  const open = (n: NotificationView) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.target) router.push(hrefFor(n.target));
  };

  const unreadCount = unread.data?.unread ?? 0;
  const rows = groupByDay(flatten(q.data), t('walletUi.group.today'), t('notifications.earlier'));

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <View style={tw`flex-row items-center justify-between px-5 pt-4 pb-3`}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={tw`flex-row items-center gap-2`}
          >
            <ArrowLeft color={color('ink')} />
            <T style={tw`text-ink font-bold text-lg`} accessibilityRole="header">
              {t('notifications.title')}
            </T>
          </Pressable>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => markRead.mutate('all')}
              disabled={markRead.isPending}
              accessibilityRole="button"
              hitSlop={12}
            >
              <T style={tw`text-teal text-xs font-semibold`}>{t('notifications.markAll')}</T>
            </Pressable>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <T style={tw`px-5 pb-1 text-xs text-slate`} accessibilityLiveRegion="polite">
            {t('notifications.unread', { count: unreadCount })}
          </T>
        ) : null}

        <FlashList
          data={rows}
          keyExtractor={(r) => (r.kind === 'group' ? `g-${r.label}` : r.n.id)}
          getItemType={(r) => r.kind}
          renderItem={({ item, index }) =>
            item.kind === 'group' ? (
              <T
                style={[
                  tw`px-1 mb-2 text-xs font-bold uppercase text-slate`,
                  index > 0 && tw`mt-3`,
                  { letterSpacing: 0.3 },
                ]}
                accessibilityRole="header"
              >
                {item.label}
              </T>
            ) : (
              <View style={tw`pb-2`}>
                <Note n={item.n} onPress={() => open(item.n)} />
              </View>
            )
          }
          contentContainerStyle={tw`px-4 pt-2 pb-28`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => {
                void q.refetch();
                void unread.refetch();
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
            ) : (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoResultsArt />}
                title={t('notifications.empty')}
                message={t('notifications.emptyBody')}
                primary={{ label: t('mySubs.findCompetition'), onPress: () => router.push('/explore') }}
              />
            )
          }
        />
      </View>
      <BottomNav active={null} />
    </SafeAreaView>
  );
}

function Note({ n, onPress }: { n: NotificationView; onPress: () => void }) {
  const { t } = useTranslation();
  const meta = TYPE[n.type];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? '' : `${t('notifications.unreadLabel')}. `}${n.title}. ${n.body}`}
      style={({ pressed }) => [
        tw`flex-row gap-3 rounded-2xl bg-white p-4`,
        n.read ? tw`shadow-sm` : ring(1, 'rgba(13,128,116,0.15)', 'sm'),
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={tw`w-10 h-10 rounded-xl items-center justify-center shrink-0 ${meta.tint}`}>
        {meta.icon(color(meta.fg))}
      </View>
      <View style={tw`flex-1 min-w-0`}>
        <View style={tw`flex-row items-start justify-between gap-2`}>
          {/* Unread shows as a dot, a ring and the screen-reader label (NFR-UX-03). */}
          <View style={tw`flex-1 flex-row items-center gap-1.5`}>
            {!n.read ? <View style={tw`w-2 h-2 rounded-full bg-teal shrink-0`} /> : null}
            <T style={tw`flex-1 font-bold text-ink text-sm leading-tight`}>{n.title}</T>
          </View>
          <T style={tw`text-[10px] text-slate shrink-0 mt-0.5`}>{formatAgo(n.createdAt, t)}</T>
        </View>
        <T style={tw`text-xs text-slate mt-1 leading-relaxed`}>{n.body}</T>
      </View>
    </Pressable>
  );
}

/** Newest first: a "Today" group, then everything older under "Earlier". */
function groupByDay(items: NotificationView[], today: string, earlier: string): Row[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rows: Row[] = [];
  let last: string | null = null;
  for (const n of items) {
    const label = new Date(n.createdAt).getTime() >= start ? today : earlier;
    if (label !== last) {
      rows.push({ kind: 'group', label });
      last = label;
    }
    rows.push({ kind: 'note', n });
  }
  return rows;
}

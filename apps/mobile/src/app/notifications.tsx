import { Ionicons } from '@expo/vector-icons';
import type { NotificationTarget, NotificationType, NotificationView } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useMarkRead, useNotifications, useUnreadCount } from '@/api/hooks';
import { useRequireSignIn } from '@/auth/session';
import { AppText, EmptyState, ErrorState, Header, type IconName, Loading } from '@/components/ui';
import { errorMessage, formatDateTime } from '@/lib/format';
import { appMaxWidth, colors, minTouch, radius, space } from '@/theme/tokens';

const typeIcon: Record<NotificationType, IconName> = {
  REGISTRATION_CONFIRMED: 'checkmark-circle-outline',
  PAYMENT_FAILED: 'card-outline',
  REFUND_ISSUED: 'return-down-back-outline',
  COMPETITION_PUBLISHED: 'rocket-outline',
  REGISTRATION_OPENED: 'notifications-outline',
  RESULTS_PUBLISHED: 'podium-outline',
  PRIZE_WON: 'trophy-outline',
  COMPETITION_CANCELLED: 'close-circle-outline',
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
      return '/competitions';
  }
}

/** US-32, US-33. */
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

  const hasUnread = (unread.data?.unread ?? 0) > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.column}>
        <FlashList
          data={flatten(q.data)}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <Item n={item} onPress={() => open(item)} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <Header
                title={t('notifications.title')}
                onBack={() => router.back()}
                right={
                  hasUnread ? (
                    <Pressable
                      onPress={() => markRead.mutate('all')}
                      disabled={markRead.isPending}
                      accessibilityRole="button"
                      hitSlop={12}
                      style={styles.markAll}
                    >
                      <AppText variant="label" color={colors.teal}>
                        {t('notifications.markAll')}
                      </AppText>
                    </Pressable>
                  ) : null
                }
              />
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => {
                void q.refetch();
                void unread.refetch();
              }}
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
              <EmptyState icon="notifications-off-outline" text={t('notifications.empty')} />
            )
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
}

function Item({ n, onPress }: { n: NotificationView; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.body}`}
      accessibilityState={{ selected: !n.read }}
      style={({ pressed }) => [styles.item, !n.read && styles.unread, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={typeIcon[n.type]} size={20} color={colors.teal} />
      </View>
      <View style={styles.flex}>
        <AppText variant={n.read ? 'body' : 'bodyStrong'}>{n.title}</AppText>
        <AppText variant="caption">{n.body}</AppText>
        <AppText variant="caption" color={colors.slate}>
          {formatDateTime(n.createdAt)}
        </AppText>
      </View>
      {/* Unread is shown by weight and background as well as the dot (NFR-UX-03). */}
      {!n.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  column: { flex: 1, width: '100%', maxWidth: appMaxWidth, alignSelf: 'center', paddingHorizontal: space.lg },
  listContent: { paddingBottom: 40 },
  header: { paddingTop: space.md, paddingBottom: space.md },
  markAll: { minHeight: minTouch, justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  unread: { backgroundColor: colors.mint },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal, marginTop: 6 },
  pressed: { opacity: 0.88 },
});

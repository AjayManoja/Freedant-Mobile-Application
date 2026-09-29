import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useUnreadCount, useUserStats, useWallet } from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import { AppText, Avatar, Card, EmptyState, Header, type IconName, Row, Screen } from '@/components/ui';
import { formatDate, formatInr } from '@/lib/format';
import { colors, minTouch, radius, space } from '@/theme/tokens';

/** Profile tab: identity, stats and the way into wallet, notifications and settings. */
export default function ProfileTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const stats = useUserStats(user?.id);
  const wallet = useWallet();
  const unread = useUnreadCount();

  if (status !== 'signedIn') {
    return (
      <Screen>
        <Header title={t('profile.title')} />
        <EmptyState
          icon="person-circle-outline"
          text={t('profile.guest')}
          action={t('profile.signIn')}
          onAction={() => requireSignIn('/profile')}
        />
        <MenuItem
          icon="settings-outline"
          label={t('profile.settings')}
          onPress={() => router.push('/settings')}
        />
      </Screen>
    );
  }

  const name = user?.displayName ?? user?.email ?? '';
  const items: { icon: IconName; label: string; to: Href; value?: string; badge?: number }[] = [
    {
      icon: 'wallet-outline',
      label: t('profile.wallet'),
      to: '/wallet',
      value: wallet.data ? formatInr(wallet.data.balancePaise) : undefined,
    },
    {
      icon: 'notifications-outline',
      label: t('profile.notifications'),
      to: '/notifications',
      badge: unread.data?.unread,
    },
    { icon: 'trophy-outline', label: t('profile.myCompetitions'), to: '/competitions' },
    { icon: 'settings-outline', label: t('profile.settings'), to: '/settings' },
  ];

  return (
    <Screen>
      <Header title={t('profile.title')} />
      <Card style={styles.hero}>
        <Avatar uri={user?.avatarUrl} name={name} size={88} />
        <AppText variant="title">{name}</AppText>
        {user?.email ? <AppText variant="caption">{user.email}</AppText> : null}
        {user?.bio ? (
          <AppText variant="body" style={styles.center}>
            {user.bio}
          </AppText>
        ) : null}
        {user?.createdAt ? (
          <AppText variant="caption">
            {t('profile.memberSince', { date: formatDate(user.createdAt) })}
          </AppText>
        ) : null}
        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          style={styles.edit}
        >
          <Ionicons name="create-outline" size={16} color={colors.teal} />
          <AppText variant="bodyStrong" color={colors.teal}>
            {t('profile.edit')}
          </AppText>
        </Pressable>
      </Card>

      <Row style={styles.stats}>
        <Stat label={t('profile.joined')} value={stats.data ? String(stats.data.joined) : '—'} />
        <Stat label={t('profile.won')} value={stats.data ? String(stats.data.won) : '—'} />
        <Stat
          label={t('profile.winnings')}
          value={stats.data ? formatInr(stats.data.totalWinningsPaise) : '—'}
          highlight
        />
      </Row>

      <View style={styles.menu}>
        {items.map((i) => (
          <MenuItem
            key={i.label}
            icon={i.icon}
            label={i.label}
            value={i.value}
            badge={i.badge}
            onPress={() => router.push(i.to)}
          />
        ))}
      </View>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  value,
  badge,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={20} color={colors.teal} />
      </View>
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="bodyStrong" color={colors.teal}>
          {value}
        </AppText>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="label" color={colors.white}>
            {badge > 99 ? '99+' : badge}
          </AppText>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.slate} />
    </Pressable>
  );
}

const Stat = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <View style={styles.stat}>
    <AppText variant="caption">{label}</AppText>
    <AppText variant="heading" color={highlight ? colors.teal : colors.ink}>
      {value}
    </AppText>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: space.xs },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: minTouch,
    paddingHorizontal: space.md,
  },
  stats: { gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: space.md, gap: 2 },
  menu: { gap: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: 60,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88 },
});

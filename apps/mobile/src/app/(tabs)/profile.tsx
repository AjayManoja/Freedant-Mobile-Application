import Constants from 'expo-constants';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  flatten,
  useHosted,
  useHostedSummary,
  useMySubmissionsSummary,
  useUnreadCount,
  useUserStats,
  useWallet,
} from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import { CompetitionRow, ConfirmDialog, inr, PersonAvatar, Press, SectionHeader } from '@/design/components';
import { EmptyState, NoEntriesArt } from '@/design/empty';
import { Bell, Chevron, Info, Megaphone, Shield, Trophy, Upload } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { formatShortDate } from '@/lib/format';

type MenuRow = { label: string; sub: string; icon: ReactNode; tint: string; to: Href };

/**
 * Profile tab — design/prototype/src/pages/ProfilePage.tsx. Out of scope and left out:
 * handle/city, the verified mark, rank, achievements, Refer & Earn, activity history and
 * help; the stats strip's third cell shows total winnings instead of a rank.
 */
export default function ProfileTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useSession((s) => s.status);
  const unread = useUnreadCount();
  const hasUnread = (unread.data?.unread ?? 0) > 0;

  const header = (
    <View style={tw`flex-row items-center justify-between px-5 pt-4 pb-3`}>
      <View>
        <T style={tw`text-slate text-xs`}>{t('profileUi.eyebrow')}</T>
        <T style={tw`text-2xl font-extrabold text-ink leading-tight`} accessibilityRole="header">
          {t('profile.title')}
        </T>
      </View>
      {status === 'signedIn' ? (
        <Press
          onPress={() => router.push('/notifications')}
          accessibilityLabel={t('profile.notifications')}
          scale={0.95}
          style={tw`w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center`}
        >
          <Bell color={color('ink')} />
          {hasUnread ? <View style={tw`absolute top-2 right-2 w-2 h-2 rounded-full bg-teal`} /> : null}
        </Press>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        {header}
        {status === 'signedIn' ? (
          <SignedIn />
        ) : (
          <ScrollView contentContainerStyle={tw`px-4 pb-28 gap-5`}>
            <EmptyState
              style={tw`py-10`}
              illustration={<NoEntriesArt />}
              title={t('profileUi.guestTitle')}
              message={t('profile.guest')}
              primary={{ label: t('profile.signIn'), onPress: () => requireSignIn('/profile') }}
            />
            <MenuGroup
              rows={[
                {
                  label: t('profile.settings'),
                  sub: t('profileUi.settingsSub'),
                  icon: <Shield color={color('slate')} />,
                  tint: 'bg-neutral-100',
                  to: '/settings',
                },
              ]}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function SignedIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const stats = useUserStats(user?.id);
  const wallet = useWallet();
  const unread = useUnreadCount();
  const subs = useMySubmissionsSummary();
  const hostedSummary = useHostedSummary();
  const hosted = flatten(useHosted().data).filter(
    (c) => c.phase !== 'DRAFT' && c.phase !== 'AWAITING_FUNDING',
  );
  const [logoutOpen, setLogoutOpen] = useState(false);

  const name = user?.displayName ?? user?.email ?? '';
  const unreadCount = unread.data?.unread ?? 0;

  const account: MenuRow[] = [
    {
      label: t('mySubs.title'),
      sub: subs.data
        ? `${t('profileUi.entries', { count: subs.data.counts.ALL })} · ${t('profileUi.wins', { count: subs.data.counts.WON })}`
        : t('design.subsActionSub'),
      icon: <Upload color={color('teal')} />,
      tint: 'bg-mint',
      to: '/submissions',
    },
    {
      label: t('myComps.title'),
      sub: hostedSummary.data
        ? t('profileUi.compsSub', { count: hostedSummary.data.counts.LIVE })
        : t('myComps.eyebrow'),
      icon: <Megaphone size={20} color={color('teal')} />,
      tint: 'bg-teal/10',
      to: '/my-competitions',
    },
    {
      label: t('profileUi.wallet'),
      sub: wallet.data
        ? t('profileUi.walletSub', { amount: inr(wallet.data.balancePaise) })
        : t('profileUi.walletFallback'),
      icon: <Trophy size={20} color={color('amber-500')} />,
      tint: 'bg-amber-50',
      to: '/wallet',
    },
    {
      label: t('profile.notifications'),
      sub: unreadCount > 0 ? t('profileUi.unread', { count: unreadCount }) : t('profileUi.caughtUp'),
      icon: <Bell color={color('rose-400')} />,
      tint: 'bg-rose-50',
      to: '/notifications',
    },
  ];
  const settings: MenuRow[] = [
    {
      label: t('profileUi.accountSettings'),
      sub: t('profileUi.settingsSub'),
      icon: <Shield color={color('slate')} />,
      tint: 'bg-neutral-100',
      to: '/settings',
    },
    {
      label: t('profileUi.legal'),
      sub: t('profileUi.legalSub'),
      icon: <Info color={color('slate')} />,
      tint: 'bg-neutral-100',
      to: '/legal/terms',
    },
  ];

  return (
    <>
      <ScrollView contentContainerStyle={tw`px-4 pb-28 gap-5`} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={tw`overflow-hidden rounded-2xl bg-teal p-5 shadow-sm`}>
          <View
            style={[
              tw`absolute -right-10 -top-12 w-40 h-40 rounded-full`,
              { backgroundColor: 'rgba(255,255,255,0.1)' },
            ]}
          />
          <View
            style={[
              tw`absolute -right-2 w-24 h-24 rounded-full`,
              { bottom: -32, backgroundColor: 'rgba(255,255,255,0.1)' },
            ]}
          />
          <View style={tw`flex-row items-center gap-4`}>
            <PersonAvatar
              uri={user?.avatarUrl}
              name={name}
              index={0}
              size={64}
              style={[tw`rounded-2xl`, { boxShadow: '0 0 0 2px rgba(255,255,255,0.4)' }]}
            />
            <View style={tw`min-w-0 flex-1`}>
              <T style={tw`text-lg font-extrabold leading-tight text-white`} numberOfLines={1}>
                {name}
              </T>
              <T style={[tw`text-sm`, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                {user?.createdAt
                  ? t('profileUi.memberSince', { email: user.email, date: formatShortDate(user.createdAt) })
                  : user?.email}
              </T>
            </View>
          </View>
          {user?.bio ? (
            <T style={[tw`mt-3 text-sm leading-snug`, { color: 'rgba(255,255,255,0.85)' }]}>{user.bio}</T>
          ) : null}

          <View
            style={[
              tw`mt-5 flex-row items-center rounded-xl px-2 py-3`,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
            ]}
          >
            {[
              {
                label: t('profile.joined'),
                value: stats.data ? String(stats.data.joined).padStart(2, '0') : '–',
              },
              { label: t('mySubs.wins'), value: stats.data ? String(stats.data.won).padStart(2, '0') : '–' },
              {
                label: t('profileUi.winnings'),
                value: stats.data ? inr(stats.data.totalWinningsPaise) : '–',
              },
            ].map((s, i, arr) => (
              <View
                key={s.label}
                style={[
                  tw`flex-1 items-center`,
                  i < arr.length - 1 && { borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
                ]}
              >
                <T style={tw`text-lg font-extrabold leading-none text-white`} numberOfLines={1}>
                  {s.value}
                </T>
                <T style={[tw`text-[11px] mt-1`, { color: 'rgba(255,255,255,0.75)' }]}>{s.label}</T>
              </View>
            ))}
          </View>

          <Press
            onPress={() => router.push('/edit-profile')}
            style={tw`mt-4 w-full rounded-xl bg-white py-2.5 items-center`}
          >
            <T style={tw`text-teal text-sm font-bold`}>{t('profile.edit')}</T>
          </Press>
        </View>

        <View>
          <SectionHeader title={t('profileUi.account')} />
          <MenuGroup rows={account} />
        </View>

        {hosted.length > 0 ? (
          <View>
            <SectionHeader
              title={t('myComps.title')}
              action={t('myComps.eyebrow')}
              onAction={() => router.push('/my-competitions')}
            />
            <View style={tw`gap-3`}>
              {hosted.slice(0, 3).map((c) => (
                <CompetitionRow key={c.id} c={c} />
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <SectionHeader title={t('settings.title')} />
          <MenuGroup rows={settings} />
        </View>

        <Press
          onPress={() => setLogoutOpen(true)}
          style={tw`w-full rounded-2xl bg-white shadow-sm py-3.5 items-center`}
        >
          <T style={tw`text-rose-500 text-sm font-bold`}>{t('profileUi.logOut')}</T>
        </Press>

        <T style={tw`text-center text-[11px] text-slate`}>
          {t('profileUi.version', { version: Constants.expoConfig?.version ?? '—' })}
        </T>
      </ScrollView>

      <ConfirmDialog
        open={logoutOpen}
        title={t('profileUi.logOutTitle')}
        message={t('profileUi.logOutBody')}
        cancel={t('common.cancel')}
        confirm={t('profileUi.logOutConfirm')}
        onConfirm={() => {
          setLogoutOpen(false);
          void useSession.getState().signOut();
        }}
        onClose={() => setLogoutOpen(false)}
      />
    </>
  );
}

/** ProfilePage MenuGroup: one white card, hairline dividers, chevrons. */
function MenuGroup({ rows }: { rows: MenuRow[] }) {
  const router = useRouter();
  return (
    <View style={tw`rounded-2xl bg-white shadow-sm overflow-hidden`}>
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          onPress={() => router.push(r.to)}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}, ${r.sub}`}
          style={({ pressed }) => [
            tw`flex-row items-center gap-3 w-full px-4 py-3`,
            i > 0 && tw`border-t border-neutral-100`,
            pressed && tw`bg-neutral-50`,
          ]}
        >
          <View style={[tw`w-10 h-10 rounded-xl items-center justify-center shrink-0 ${r.tint}`]}>
            {r.icon}
          </View>
          <View style={tw`flex-1 min-w-0`}>
            <T style={tw`font-bold text-ink text-sm leading-tight`}>{r.label}</T>
            <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
              {r.sub}
            </T>
          </View>
          <Chevron color={color('slate')} rotate={-90} />
        </Pressable>
      ))}
    </View>
  );
}

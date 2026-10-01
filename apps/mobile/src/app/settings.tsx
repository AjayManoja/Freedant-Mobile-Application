import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAccount, useUnreadCount } from '@/api/hooks';
import { requireSignIn, useSession } from '@/auth/session';
import {
  BottomSheet,
  ConfirmDialog,
  Input,
  PageHeader,
  PersonAvatar,
  Press,
  Spinner,
  useToast,
} from '@/design/components';
import { Bell, Chevron, Info, Lock, Mail, Trash } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { errorMessage } from '@/lib/format';

/**
 * US-04 (sign out), US-07 (delete account) and the legal pages —
 * design/prototype/src/pages/SettingsPage.tsx. Phone, password, two-factor, language,
 * dark mode and the privacy toggles are out of scope and left out.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const unread = useUnreadCount();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, showToast] = useToast();
  const signedIn = status === 'signedIn';

  const signOut = async () => {
    setLogoutOpen(false);
    await useSession.getState().signOut();
    router.replace('/(tabs)');
  };

  const unreadCount = unread.data?.unread ?? 0;

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <PageHeader subtitle={t('settingsUi.eyebrow')} title={t('settings.title')} />
        <ScrollView contentContainerStyle={tw`px-4 pb-16 gap-6`} showsVerticalScrollIndicator={false}>
          {/* Account card */}
          <Press
            onPress={() => (signedIn ? router.push('/profile') : requireSignIn('/settings'))}
            style={tw`flex-row items-center gap-3.5 w-full rounded-2xl bg-white p-3.5 shadow-sm`}
          >
            <PersonAvatar
              uri={user?.avatarUrl}
              name={user?.displayName ?? user?.email ?? 'F'}
              index={0}
              size={56}
              style={tw`rounded-2xl`}
            />
            <View style={tw`flex-1 min-w-0`}>
              <T style={tw`font-extrabold text-ink leading-tight`} numberOfLines={1}>
                {signedIn ? (user?.displayName ?? user?.email) : t('profileUi.guestTitle')}
              </T>
              <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
                {signedIn ? t('settingsUi.viewProfile', { email: user?.email }) : t('profile.signIn')}
              </T>
            </View>
            <Chevron color={color('slate')} rotate={-90} />
          </Press>

          {signedIn ? (
            <Group title={t('profileUi.account')}>
              <Row
                icon={<Mail size={18} color={color('teal')} />}
                tint="bg-mint"
                label={t('settingsUi.email')}
                value={user?.email}
                onPress={() => showToast(t('settingsUi.emailToast'))}
              />
              <Row
                icon={<Lock size={18} color={color('amber-500')} />}
                tint="bg-amber-50"
                label={t('settingsUi.signIn')}
                value={t('settingsUi.signInValue')}
              />
            </Group>
          ) : null}

          {signedIn ? (
            <Group title={t('notifications.title')}>
              <Row
                icon={<Bell size={18} color={color('teal')} />}
                tint="bg-mint"
                label={t('settingsUi.inbox')}
                value={
                  unreadCount > 0 ? t('profileUi.unread', { count: unreadCount }) : t('profileUi.caughtUp')
                }
                onPress={() => router.push('/notifications')}
              />
            </Group>
          ) : null}

          <Group title={t('settingsUi.support')}>
            <Row
              icon={<Info size={18} color={color('indigo-400')} />}
              tint="bg-indigo-50"
              label={t('settingsUi.about')}
              value={t('settingsUi.aboutValue')}
            />
            <Row label={t('legal.terms')} onPress={() => router.push('/legal/terms')} />
            <Row label={t('legal.privacy')} onPress={() => router.push('/legal/privacy')} />
            <Row
              label={t('settingsUi.version')}
              value={t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
            />
          </Group>

          {signedIn ? (
            <View style={tw`gap-3`}>
              <Press
                onPress={() => setLogoutOpen(true)}
                style={tw`w-full rounded-2xl bg-white shadow-sm py-3.5 items-center`}
              >
                <T style={tw`text-ink text-sm font-bold`}>{t('profileUi.logOut')}</T>
              </Press>
              <Press
                onPress={() => setDeleteOpen(true)}
                style={tw`flex-row items-center justify-center gap-2 w-full rounded-2xl bg-rose-50 py-3.5`}
              >
                <Trash color={color('rose-500')} />
                <T style={tw`text-rose-500 text-sm font-bold`}>{t('settingsUi.deleteAccount')}</T>
              </Press>
            </View>
          ) : null}

          <T style={tw`text-center text-[11px] text-slate`}>{t('settingsUi.footer')}</T>
        </ScrollView>
        {toast}
      </View>

      <ConfirmDialog
        open={logoutOpen}
        title={t('profileUi.logOutTitle')}
        message={t('profileUi.logOutBody')}
        cancel={t('common.cancel')}
        confirm={t('profileUi.logOutConfirm')}
        onConfirm={() => void signOut()}
        onClose={() => setLogoutOpen(false)}
      />
      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </SafeAreaView>
  );
}

/** SettingsPage Group: an uppercase caption over one white card of rows. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View>
      <T
        style={[tw`text-[11px] font-bold uppercase text-slate mb-2 px-1`, { letterSpacing: 0.275 }]}
        accessibilityRole="header"
      >
        {title}
      </T>
      <View style={tw`rounded-2xl bg-white shadow-sm overflow-hidden`}>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? tw`border-t border-neutral-100` : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/** SettingsPage NavRow: optional tinted icon, label over value, chevron when it goes somewhere. */
function Row({
  icon,
  tint,
  label,
  value,
  onPress,
}: {
  icon?: ReactNode;
  tint?: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        tw`flex-row items-center gap-3 w-full px-4 py-3`,
        pressed && tw`bg-neutral-50`,
      ]}
    >
      {icon ? (
        <View style={tw`w-9 h-9 rounded-xl items-center justify-center shrink-0 ${tint ?? ''}`}>{icon}</View>
      ) : null}
      <View style={tw`flex-1 min-w-0`}>
        <T style={tw`font-bold text-ink text-sm leading-tight`}>{label}</T>
        {value ? (
          <T style={tw`text-xs text-slate mt-0.5`} numberOfLines={1}>
            {value}
          </T>
        ) : null}
      </View>
      {onPress ? <Chevron color={color('slate')} rotate={-90} /> : null}
    </Pressable>
  );
}

/** US-07: an irreversible delete, armed only once the user types DELETE. */
function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = t('settingsUi.deleteWord');
  const armed = text.trim().toUpperCase() === word;

  const close = () => {
    if (busy) return;
    setText('');
    setError(null);
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      await useSession.getState().forget();
      onClose();
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={close}>
      <View style={tw`mt-5 items-center`}>
        <View style={tw`w-14 h-14 items-center justify-center rounded-2xl bg-rose-50`}>
          <Trash size={24} color={color('rose-500')} />
        </View>
        <T style={tw`mt-3 text-lg font-extrabold text-ink text-center`} accessibilityRole="header">
          {t('settingsUi.deleteTitle')}
        </T>
        <T style={tw`mt-1 text-sm text-slate px-2 text-center`}>{t('settingsUi.deleteBody')}</T>
      </View>

      <View style={tw`mt-4`}>
        <T style={tw`text-xs font-semibold text-slate`}>
          {t('settingsUi.typeBefore')}
          <T style={tw`font-extrabold text-rose-500`}>{word}</T>
          {t('settingsUi.typeAfter')}
        </T>
        <View style={tw`mt-1`}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder={word}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t('settingsUi.typeLabel', { word })}
          />
        </View>
        {error ? <T style={tw`mt-1 text-[11px] font-medium text-rose-500`}>{error}</T> : null}
      </View>

      <View style={tw`mt-4 flex-row gap-3`}>
        <Press onPress={close} style={tw`flex-1 rounded-xl bg-neutral-100 py-3.5 items-center`}>
          <T style={tw`text-sm font-bold text-ink`}>{t('common.cancel')}</T>
        </Press>
        <Press
          onPress={() => void remove()}
          disabled={!armed || busy}
          accessibilityState={{ disabled: !armed || busy, busy }}
          style={[
            tw`flex-1 rounded-xl bg-rose-500 py-3.5 items-center justify-center flex-row gap-2`,
            (!armed || busy) && tw`opacity-50`,
          ]}
        >
          {busy ? <Spinner /> : null}
          <T style={tw`text-sm font-bold text-white`}>{t('settingsUi.deleteForever')}</T>
        </Press>
      </View>
    </BottomSheet>
  );
}

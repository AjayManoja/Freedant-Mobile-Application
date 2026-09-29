import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { deleteAccount } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { AppText, Button, ConfirmSheet, Header, type IconName, Notice, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

/** US-04 (sign out), US-07 (delete account) and the legal pages. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useSession((s) => s.status);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    await useSession.getState().signOut();
    setSigningOut(false);
    router.replace('/(tabs)');
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      await useSession.getState().forget();
      setConfirmDelete(false);
      router.replace('/(tabs)');
    } catch (e) {
      setConfirmDelete(false);
      setError(errorMessage(e, t));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('settings.title')} onBack={() => router.back()} />
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      <View style={styles.group}>
        <Link
          icon="document-text-outline"
          label={t('settings.terms')}
          onPress={() => router.push('/legal/terms')}
        />
        <Link
          icon="shield-checkmark-outline"
          label={t('settings.privacy')}
          onPress={() => router.push('/legal/privacy')}
        />
      </View>

      {status === 'signedIn' ? (
        <View style={styles.group}>
          <Button
            title={t('settings.signOut')}
            kind="ghost"
            icon="log-out-outline"
            onPress={() => void signOut()}
            loading={signingOut}
          />
          <Button
            title={t('settings.delete')}
            kind="danger"
            icon="trash-outline"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      ) : null}

      <AppText variant="caption" style={styles.center}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
      </AppText>

      <ConfirmSheet
        visible={confirmDelete}
        title={t('settings.delete')}
        message={t('settings.deleteConfirm')}
        confirm={t('settings.delete')}
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function Link({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.teal} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  group: { gap: space.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: 56,
  },
  pressed: { opacity: 0.88 },
});

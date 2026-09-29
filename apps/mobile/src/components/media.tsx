import { Ionicons } from '@expo/vector-icons';
import type { MediaKind } from '@feedants/shared';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { AppText } from './ui';

/**
 * Images render inline; video and audio open in the system browser, which plays them
 * without adding a native media module to the build.
 */
export function MediaPreview({ url, kind }: { url: string | null; kind: MediaKind | null }) {
  const { t } = useTranslation();
  if (!url) return null;
  if (kind === 'IMAGE') {
    return (
      <Image
        source={{ uri: url }}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel={t('submission.media')}
      />
    );
  }
  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      accessibilityRole="button"
      accessibilityLabel={t('common.openMedia')}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Ionicons
        name={kind === 'VIDEO' ? 'play-circle-outline' : 'musical-notes-outline'}
        size={36}
        color={colors.teal}
      />
      <AppText variant="bodyStrong" color={colors.teal}>
        {t('common.openMedia')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.mint },
  tile: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
});

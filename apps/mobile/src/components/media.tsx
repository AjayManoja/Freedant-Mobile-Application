import type { MediaKind } from '@feedants/shared';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Press } from '@/design/components';
import { Chat, Play } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';

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
        style={[tw`w-full rounded-2xl bg-mint`, { aspectRatio: 4 / 3 }]}
        contentFit="cover"
        accessibilityLabel={t('submission.media')}
      />
    );
  }
  return (
    <Press
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      accessibilityLabel={t('common.openMedia')}
      style={tw`h-36 rounded-2xl bg-mint items-center justify-center gap-2`}
    >
      <View style={tw`w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm`}>
        {kind === 'VIDEO' ? <Play color={color('teal')} /> : <Chat color={color('teal')} />}
      </View>
      <T style={tw`text-sm font-bold text-teal`}>{t('common.openMedia')}</T>
    </Press>
  );
}

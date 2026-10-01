import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import tw, { color } from './tw';

/** Full-area spinner for a screen or list that has nothing to show yet. */
export function Loading() {
  const { t } = useTranslation();
  return (
    <View style={tw`flex-1 items-center justify-center py-10 bg-canvas`} accessibilityLabel={t('common.loading')}>
      <ActivityIndicator color={color('teal')} size="large" />
    </View>
  );
}

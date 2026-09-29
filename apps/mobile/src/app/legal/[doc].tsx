import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Header, Screen } from '@/components/ui';

/** Placeholder Terms and Privacy pages (SCOPE: portfolio demo in payment test mode). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={doc === 'privacy' ? t('legal.privacy') : t('legal.terms')}
        onBack={() => router.back()}
      />
      <AppText variant="body">{t('legal.placeholder')}</AppText>
    </Screen>
  );
}

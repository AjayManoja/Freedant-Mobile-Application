import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, type IconName, Screen } from '@/components/ui';
import { colors, space } from '@/theme/tokens';
import { ONBOARDED_KEY } from '@/lib/keys';

const slides: { icon: IconName; title: string; body: string }[] = [
  { icon: 'trophy-outline', title: 'onboarding.title1', body: 'onboarding.body1' },
  { icon: 'megaphone-outline', title: 'onboarding.title2', body: 'onboarding.body2' },
  { icon: 'shield-checkmark-outline', title: 'onboarding.title3', body: 'onboarding.body3' },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const [i, setI] = useState(0);
  const slide = slides[i]!;
  const last = i === slides.length - 1;

  const finish = async (signIn: boolean) => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => undefined);
    router.replace('/(tabs)');
    if (signIn) router.push('/sign-in');
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          <Button
            title={last ? t('onboarding.start') : t('common.continue')}
            onPress={() => (last ? void finish(true) : setI(i + 1))}
          />
          <Button title={t('onboarding.browse')} kind="ghost" onPress={() => void finish(false)} />
        </>
      }
    >
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Ionicons name={slide.icon} size={56} color={colors.teal} />
        </View>
        <AppText variant="display" style={styles.center} accessibilityRole="header">
          {t(slide.title)}
        </AppText>
        <AppText variant="body" style={styles.center}>
          {t(slide.body)}
        </AppText>
        <View style={styles.dots} accessibilityLabel={`${i + 1} / ${slides.length}`}>
          {slides.map((_, n) => (
            <View key={n} style={[styles.dot, n === i && styles.dotActive]} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 460, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.teal },
});

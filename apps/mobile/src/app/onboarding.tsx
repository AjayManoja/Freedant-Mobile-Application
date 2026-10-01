import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Press } from '@/design/components';
import { Gradient } from '@/design/gradient';
import { Chevron, Fire, Megaphone, Star, Trophy, Upload } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { ONBOARDED_KEY } from '@/lib/keys';

type Chip = { key: string; pos: object; rotate: string };
type Slide = { icon: (c: string) => ReactNode; colors: [string, string]; chips: Chip[]; key: string };

/** components/Onboarding.tsx SLIDES: gradient panel, tilted chips, title and line. */
const SLIDES: Slide[] = [
  {
    key: 'discover',
    icon: (c) => <Fire size={56} color={c} />,
    colors: [color('teal'), color('teal-dark')],
    chips: [
      { key: 'dance', pos: { top: 32, left: 24 }, rotate: '-6deg' },
      { key: 'music', pos: { top: 64, right: 24 }, rotate: '5deg' },
      { key: 'photo', pos: { bottom: 40, left: 40 }, rotate: '4deg' },
      { key: 'coding', pos: { bottom: 64, right: 32 }, rotate: '-4deg' },
    ],
  },
  {
    key: 'compete',
    icon: (c) => <Upload size={56} color={c} />,
    colors: [color('indigo-400'), color('indigo-600')],
    chips: [
      { key: 'upload', pos: { top: 40, left: 24 }, rotate: '-5deg' },
      { key: 'formats', pos: { top: 80, right: 24 }, rotate: '6deg' },
      { key: 'judged', pos: { bottom: 48, left: 32 }, rotate: '3deg' },
    ],
  },
  {
    key: 'win',
    icon: (c) => <Trophy size={56} color={c} />,
    colors: [color('amber-400'), color('orange-500')],
    chips: [
      { key: 'prizes', pos: { top: 32, right: 32 }, rotate: '6deg' },
      { key: 'ranked', pos: { top: 80, left: 24 }, rotate: '-5deg' },
      { key: 'wallet', pos: { bottom: 48, right: 24 }, rotate: '4deg' },
    ],
  },
  {
    key: 'host',
    icon: (c) => <Megaphone size={56} color={c} />,
    colors: [color('fuchsia-500'), color('purple-600')],
    chips: [
      { key: 'launch', pos: { top: 40, left: 24 }, rotate: '-6deg' },
      { key: 'judge', pos: { top: 80, right: 24 }, rotate: '5deg' },
      { key: 'earn', pos: { bottom: 48, left: 40 }, rotate: '4deg' },
    ],
  },
];

/** Shown once per install (SCOPE screen inventory). */
export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const track = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  const go = (n: number) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, n));
    setI(next);
    track.current?.scrollTo({ x: next * width, animated: true });
  };

  const finish = async (signIn: boolean) => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => undefined);
    router.replace('/(tabs)');
    if (signIn) router.push('/sign-in');
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setI(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        {/* Skip */}
        <View style={tw`flex-row justify-end px-5 pt-5`}>
          <Pressable
            onPress={() => void finish(false)}
            disabled={last}
            accessibilityRole="button"
            accessibilityElementsHidden={last}
            hitSlop={8}
            style={{ opacity: last ? 0 : 1 }}
          >
            <T style={tw`text-sm font-semibold text-slate`}>{t('onboarding.skip')}</T>
          </Pressable>
        </View>

        {/* Sliding track */}
        <View style={tw`flex-1`} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <ScrollView
              ref={track}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              onScrollEndDrag={onScrollEnd}
              scrollEventThrottle={16}
            >
              {SLIDES.map((s) => (
                <View key={s.key} style={[tw`items-center px-8`, { width }]}>
                  <Gradient
                    dir="br"
                    colors={s.colors}
                    style={[
                      tw`mt-4 w-full max-w-[300px] items-center justify-center overflow-hidden shadow-lg`,
                      { aspectRatio: 1, borderRadius: 36 },
                    ]}
                  >
                    <View
                      style={[
                        tw`absolute -top-10 -right-10 h-40 w-40 rounded-full`,
                        { backgroundColor: 'rgba(255,255,255,0.15)' },
                      ]}
                    />
                    <View
                      style={[
                        tw`absolute -left-10 h-44 w-44 rounded-full`,
                        { bottom: -48, backgroundColor: 'rgba(0,0,0,0.1)' },
                      ]}
                    />
                    {s.chips.map((c) => (
                      <View
                        key={c.key}
                        style={[
                          tw`absolute rounded-full px-3 py-1.5 shadow-md`,
                          { backgroundColor: 'rgba(255,255,255,0.9)', transform: [{ rotate: c.rotate }] },
                          c.pos,
                        ]}
                      >
                        <T style={tw`text-[11px] font-bold text-ink`}>
                          {t(`onboarding.slides.${s.key}.chips.${c.key}`)}
                        </T>
                      </View>
                    ))}
                    <View
                      style={[
                        tw`h-24 w-24 items-center justify-center rounded-3xl`,
                        { backgroundColor: 'rgba(255,255,255,0.2)' },
                        ring(1, 'rgba(255,255,255,0.4)'),
                      ]}
                    >
                      {s.icon('#fff')}
                    </View>
                  </Gradient>

                  <T style={tw`mt-9 text-center text-2xl font-extrabold text-ink`} accessibilityRole="header">
                    {t(`onboarding.slides.${s.key}.title`)}
                  </T>
                  <T style={tw`mt-2.5 max-w-[300px] text-center text-sm leading-relaxed text-slate`}>
                    {t(`onboarding.slides.${s.key}.body`)}
                  </T>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* Footer: dots + CTA */}
        <View style={tw`px-8 pb-10 pt-2`}>
          <View style={tw`mb-6 flex-row items-center justify-center gap-2`}>
            {SLIDES.map((s, idx) => (
              <Pressable
                key={s.key}
                onPress={() => go(idx)}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.goTo', { n: idx + 1 })}
                accessibilityState={{ selected: idx === i }}
                hitSlop={6}
                style={[
                  tw`h-2 rounded-full`,
                  idx === i ? tw`w-6 bg-teal` : [tw`w-2`, { backgroundColor: 'rgba(13,128,116,0.25)' }],
                ]}
              />
            ))}
          </View>

          <Press
            onPress={() => (last ? void finish(true) : go(i + 1))}
            style={tw`w-full flex-row items-center justify-center gap-2 rounded-xl bg-teal py-3.5 shadow-sm`}
          >
            <T style={tw`text-sm font-extrabold text-white`}>
              {last ? t('onboarding.start') : t('onboarding.next')}
            </T>
            {last ? <Star size={16} color="#fff" /> : <Chevron size={16} color="#fff" rotate={-90} />}
          </Press>
        </View>
      </View>
    </SafeAreaView>
  );
}

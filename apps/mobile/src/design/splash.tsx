import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, View } from 'react-native';
import { Gradient } from './gradient';
import { Trophy } from './icons';
import { T } from './text';
import tw, { color } from './tw';

const HOLD_MS = 1900;
const FADE_MS = 500;
const native = false; // web has no native driver; the values are cheap either way

/**
 * components/SplashScreen.tsx: the brand moment after the native splash (same teal), with the
 * logo popping in, a pulsing ring, the wordmark rising and a looping loader, then a fade
 * that reveals the app underneath.
 */
export function BrandSplash({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const riseLate = useRef(new Animated.Value(0)).current;
  const ping = useRef(new Animated.Value(0)).current;
  const loader = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: native }).start();
    Animated.timing(rise, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    Animated.timing(riseLate, { toValue: 1, duration: 500, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    const pings = Animated.loop(Animated.timing(ping, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: native }));
    const loads = Animated.loop(Animated.timing(loader, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: native }));
    pings.start();
    loads.start();
    const hold = setTimeout(
      () => Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: native }).start(),
      HOLD_MS,
    );
    // A timer, not the animation's callback, ends the splash: it must never stay up.
    const done = setTimeout(onFinish, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
      pings.stop();
      loads.stop();
    };
  }, [fade, pop, rise, riseLate, ping, loader, onFinish]);

  const lift = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });

  return (
    <Animated.View
      style={[tw`absolute inset-0 z-50 items-center bg-canvas`, { opacity: fade }]}
      accessibilityLabel={t('splash.label')}
    >
      <Gradient dir="b" colors={[color('teal'), color('teal-dark')]} style={tw`flex-1 w-full max-w-[430px] overflow-hidden items-center justify-center`}>
        {/* Ambient glows */}
        <View style={[tw`absolute -top-16 -right-16 h-56 w-56 rounded-full`, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
        <View style={[tw`absolute -bottom-20 -left-16 h-64 w-64 rounded-full`, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

        <View style={tw`items-center`}>
          <Animated.View
            style={[
              tw`h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-2xl`,
              { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
            ]}
          >
            <Animated.View
              style={[
                tw`absolute inset-0 rounded-[28px]`,
                {
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.4)',
                  opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                },
              ]}
            />
            <Trophy size={48} color={color('teal')} />
          </Animated.View>

          <Animated.View style={lift(rise)}>
            <T style={[tw`mt-6 text-4xl font-extrabold text-white`, { letterSpacing: -0.9 }]} accessibilityRole="header">
              Feedants
            </T>
          </Animated.View>
          <Animated.View style={lift(riseLate)}>
            <T style={[tw`mt-2 text-sm font-medium`, { color: 'rgba(255,255,255,0.8)' }]}>{t('splash.tagline')}</T>
          </Animated.View>
        </View>

        {/* Progress + footer */}
        <View style={tw`absolute bottom-14 w-full items-center gap-4 px-10`}>
          <View style={[tw`h-1 w-40 overflow-hidden rounded-full`, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Animated.View
              style={[
                tw`h-full rounded-full bg-white`,
                { width: '33%', transform: [{ translateX: loader.interpolate({ inputRange: [0, 1], outputRange: [-56, 160] }) }] },
              ]}
            />
          </View>
          <T style={[tw`text-[11px] font-medium uppercase`, { color: 'rgba(255,255,255,0.6)', letterSpacing: 2.2 }]}>
            {t('splash.madeIn')}
          </T>
        </View>
      </Gradient>
    </Animated.View>
  );
}

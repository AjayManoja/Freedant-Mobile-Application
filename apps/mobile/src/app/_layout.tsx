import '@/i18n';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/api/query-client';
import { useSession } from '@/auth/session';
import { BrandSplash } from '@/design/splash';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Fonts are bundled at build time (UI_TOKENS §2), so this resolves without a network.
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const status = useSession((s) => s.status);
  // The brand splash plays once per cold start, over the app as it renders underneath.
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    void useSession.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (fontsLoaded && status !== 'loading') void SplashScreen.hideAsync();
  }, [fontsLoaded, status]);

  if (!fontsLoaded || status === 'loading') return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        </Stack>
        {splash ? <BrandSplash onFinish={endSplash} /> : null}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

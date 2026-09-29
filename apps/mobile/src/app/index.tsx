import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ONBOARDED_KEY } from '@/lib/keys';

/** Onboarding is shown once per install (SCOPE screen inventory). */
export default function Entry() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === '1'))
      .catch(() => setOnboarded(true));
  }, []);
  if (onboarded === null) return null;
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}

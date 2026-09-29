import { Redirect } from 'expo-router';

/** Placeholder route: the "+" tab opens the create sheet and never navigates here. */
export default function Create() {
  return <Redirect href="/(tabs)" />;
}

import type { MeResponse, VerifyOtpResponse } from '@feedants/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';
import { api, auth } from '@/api/client';
import { queryClient } from '@/api/query-client';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  user: MeResponse | null;
  /** Screen to return to after signing in (FR-ID-08). */
  returnTo: string | null;
  bootstrap: () => Promise<void>;
  signedIn: (res: VerifyOtpResponse) => Promise<void>;
  setUser: (user: MeResponse) => void;
  signOut: () => Promise<void>;
  forget: () => Promise<void>;
  setReturnTo: (path: string | null) => void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  returnTo: null,

  async bootstrap() {
    const stored = await auth.load();
    if (!stored) return set({ status: 'signedOut' });
    try {
      const user = await api<MeResponse>('/v1/me', { auth: 'required' });
      set({ status: 'signedIn', user });
    } catch (e) {
      // Offline: stay signed in with cached data (NFR-UX-07); otherwise the session is gone.
      if ((e as { code?: string }).code === 'NETWORK') set({ status: 'signedIn' });
      else {
        await auth.clear();
        set({ status: 'signedOut' });
      }
    }
  },

  async signedIn(res) {
    await auth.set(res);
    set({ status: 'signedIn', user: res.user });
  },

  setUser(user) {
    set({ user });
  },

  /** US-04: revoke this device's session and clear cached personal data. */
  async signOut() {
    try {
      await api('/v1/auth/logout', { method: 'POST', auth: 'required' });
    } catch {
      /* signing out locally still matters when offline */
    }
    await get().forget();
  },

  async forget() {
    await auth.clear();
    queryClient.clear();
    set({ status: 'signedOut', user: null });
  },

  setReturnTo(path) {
    set({ returnTo: path });
  },
}));

auth.onSignedOut(() => {
  queryClient.clear();
  useSession.setState({ status: 'signedOut', user: null });
});

/**
 * FR-ID-08 / US-06: guests browse freely; an action that needs an account sends them to
 * sign in and back to where they were.
 */
export function requireSignIn(returnTo: string): boolean {
  const { status, setReturnTo } = useSession.getState();
  if (status === 'signedIn') return true;
  setReturnTo(returnTo);
  router.push('/sign-in');
  return false;
}

/**
 * For screens that only make sense signed in (wallet, notifications): a guest who lands on
 * one, e.g. from a deep link, is swapped for sign-in and brought back afterwards.
 */
export function useRequireSignIn(returnTo: string): boolean {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status !== 'signedOut') return;
    useSession.getState().setReturnTo(returnTo);
    router.replace('/sign-in');
  }, [status, returnTo]);
  return status === 'signedIn';
}

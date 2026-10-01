import type {
  CompetitionDetail,
  CompetitionSummary,
  CountedPage,
  CategoryListing,
  DraftUpdateInput,
  HomeResponse,
  HostedCompetition,
  HostedFilter,
  HostedSummary,
  JoinResponse,
  JudgingEntry,
  Leaderboard,
  ListQuery,
  MeResponse,
  MySubmissionsSummary,
  NotificationView,
  Page,
  PublicUser,
  PublishResponse,
  RegistrationView,
  SubmissionDisplayStatus,
  SubmissionUpdateInput,
  SubmissionView,
  UnreadCount,
  UpdateProfileInput,
  UploadUrlResponse,
  UserStats,
  WalletSummary,
  WalletTransaction,
  WinnerProfile,
} from '@feedants/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { api } from './client';

const signedIn = () => useSession.getState().status === 'signedIn';
const pageParams = {
  initialPageParam: undefined as string | undefined,
  getNextPageParam: <T>(p: Page<T>) => p.nextCursor ?? undefined,
};
export const flatten = <T>(d: InfiniteData<Page<T>> | undefined): T[] =>
  d?.pages.flatMap((p) => p.items) ?? [];

// ---------------------------------------------------------------- discovery

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryListing[]>('/v1/categories', { auth: 'none' }),
    staleTime: 5 * 60_000,
  });

export const useHome = () => {
  const status = useSession((s) => s.status);
  return useQuery({
    queryKey: ['home', status],
    queryFn: () => api<HomeResponse>('/v1/home', { auth: 'optional' }),
  });
};

export const useCompetitions = (q: Omit<ListQuery, 'cursor' | 'limit'>) =>
  useInfiniteQuery({
    queryKey: ['competitions', q],
    queryFn: ({ pageParam }) =>
      api<CountedPage<CompetitionSummary>>('/v1/competitions', {
        auth: 'none',
        query: { ...q, cursor: pageParam },
      }),
    ...pageParams,
  });

export const useSearch = (q: string) =>
  useInfiniteQuery({
    queryKey: ['search', q],
    enabled: q.trim().length >= 2,
    queryFn: ({ pageParam }) =>
      api<Page<CompetitionSummary>>('/v1/search', {
        auth: 'none',
        query: { q: q.trim(), cursor: pageParam },
      }),
    ...pageParams,
  });

export const useCompetition = (id: string | undefined) => {
  const status = useSession((s) => s.status);
  return useQuery({
    queryKey: ['competition', id, status],
    enabled: !!id,
    queryFn: () => api<CompetitionDetail>(`/v1/competitions/${id}`, { auth: 'optional' }),
  });
};

export const useLeaderboard = (id: string) =>
  useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api<Leaderboard>(`/v1/competitions/${id}/leaderboard`, { auth: 'none' }),
  });

export const useWinner = (userId: string) =>
  useQuery({
    queryKey: ['winner', userId],
    queryFn: () => api<WinnerProfile>(`/v1/winners/${userId}`, { auth: 'none' }),
  });

export const useUserStats = (userId: string | undefined) =>
  useQuery({
    queryKey: ['stats', userId],
    enabled: !!userId,
    queryFn: () => api<UserStats>(`/v1/users/${userId}/stats`, { auth: 'none' }),
  });

export function useNotify(competitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) =>
      api<{ notifyOn: boolean }>(`/v1/competitions/${competitionId}/notify`, {
        method: on ? 'PUT' : 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
  });
}

// ---------------------------------------------------------------- identity

export const useMe = () =>
  useQuery({ queryKey: ['me'], enabled: signedIn(), queryFn: () => api<MeResponse>('/v1/me') });

export const usePublicUser = (id: string) =>
  useQuery({ queryKey: ['user', id], queryFn: () => api<PublicUser>(`/v1/users/${id}`, { auth: 'none' }) });

/** US-05: presigned upload target for a new avatar; the key is then saved with PATCH /v1/me. */
export const avatarUploadUrl = (contentType: string, sizeBytes: number) =>
  api<UploadUrlResponse>('/v1/me/avatar-upload-url', { method: 'POST', body: { contentType, sizeBytes } });

/** US-07 */
export const deleteAccount = () => api<void>('/v1/me', { method: 'DELETE' });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<MeResponse>('/v1/me', { method: 'PATCH', body: input }),
    onSuccess: (me) => {
      useSession.getState().setUser(me);
      qc.setQueryData(['me'], me);
    },
  });
}

// ---------------------------------------------------------------- hosting

export const useHosted = (filter?: HostedFilter) =>
  useInfiniteQuery({
    queryKey: ['hosted', filter],
    enabled: signedIn(),
    queryFn: ({ pageParam }) =>
      api<Page<HostedCompetition>>('/v1/me/competitions', { query: { filter, cursor: pageParam } }),
    ...pageParams,
  });

/** Under the ['hosted'] key, so every invalidation of the list refreshes it too. */
export const useHostedSummary = () =>
  useQuery({
    queryKey: ['hosted', 'summary'],
    enabled: signedIn(),
    queryFn: () => api<HostedSummary>('/v1/me/competitions/summary'),
  });

export const saveDraft = (id: string | null, input: DraftUpdateInput) =>
  id
    ? api<CompetitionDetail>(`/v1/competitions/${id}`, { method: 'PATCH', body: input })
    : api<CompetitionDetail>('/v1/competitions', { method: 'POST', body: input });

export const publish = (id: string, idempotencyKey: string) =>
  api<PublishResponse>(`/v1/competitions/${id}/publish`, { method: 'POST', idempotencyKey });

/** Gives up on a pending funding payment and returns the competition to Draft. */
export const abandonFunding = (id: string) =>
  api<CompetitionDetail>(`/v1/competitions/${id}/funding`, { method: 'DELETE' });

export const coverUploadUrl = (id: string, contentType: string, sizeBytes: number) =>
  api<UploadUrlResponse>(`/v1/competitions/${id}/cover-upload-url`, {
    method: 'POST',
    body: { contentType, sizeBytes },
  });

export const cancelCompetition = (id: string) =>
  api<CompetitionDetail>(`/v1/competitions/${id}/cancel`, { method: 'POST' });

// ---------------------------------------------------------------- joining

export const join = (id: string, idempotencyKey: string) =>
  api<JoinResponse>(`/v1/competitions/${id}/join`, { method: 'POST', idempotencyKey });

export const getRegistration = (id: string) => api<RegistrationView>(`/v1/registrations/${id}`);

// ---------------------------------------------------------------- submissions

export const useSubmission = (registrationId: string) =>
  useQuery({
    queryKey: ['submission', registrationId],
    queryFn: () => api<SubmissionView>(`/v1/registrations/${registrationId}/submission`),
  });

export const updateSubmission = (registrationId: string, input: SubmissionUpdateInput) =>
  api<SubmissionView>(`/v1/registrations/${registrationId}/submission`, { method: 'PATCH', body: input });

export const mediaUploadUrl = (registrationId: string, contentType: string, sizeBytes: number) =>
  api<UploadUrlResponse>(`/v1/registrations/${registrationId}/submission/media-upload-url`, {
    method: 'POST',
    body: { contentType, sizeBytes },
  });

export const submitEntry = (registrationId: string) =>
  api<SubmissionView>(`/v1/registrations/${registrationId}/submission/submit`, { method: 'POST' });

export const useMySubmissions = (status?: SubmissionDisplayStatus) =>
  useInfiniteQuery({
    queryKey: ['my-submissions', status],
    enabled: signedIn(),
    queryFn: ({ pageParam }) =>
      api<Page<SubmissionView>>('/v1/me/submissions', { query: { status, cursor: pageParam } }),
    ...pageParams,
  });

/** Under the ['my-submissions'] key, so every invalidation of the list refreshes it too. */
export const useMySubmissionsSummary = () =>
  useQuery({
    queryKey: ['my-submissions', 'summary'],
    enabled: signedIn(),
    queryFn: () => api<MySubmissionsSummary>('/v1/me/submissions/summary'),
  });

// ---------------------------------------------------------------- judging

export const useEntries = (competitionId: string) =>
  useQuery({
    queryKey: ['entries', competitionId],
    queryFn: () => api<JudgingEntry[]>(`/v1/competitions/${competitionId}/entries`),
  });

export const scoreEntry = (submissionId: string, score: number, comment: string | null) =>
  api<JudgingEntry>(`/v1/submissions/${submissionId}/score`, { method: 'PUT', body: { score, comment } });

export const publishResults = (competitionId: string) =>
  api<Leaderboard>(`/v1/competitions/${competitionId}/results`, { method: 'POST' });

// ---------------------------------------------------------------- wallet & notifications

export const useWallet = () =>
  useQuery({ queryKey: ['wallet'], enabled: signedIn(), queryFn: () => api<WalletSummary>('/v1/wallet') });

export const useWalletHistory = (filter: 'all' | 'earnings' | 'entries' | 'refunds') =>
  useInfiniteQuery({
    queryKey: ['wallet-history', filter],
    enabled: signedIn(),
    queryFn: ({ pageParam }) =>
      api<Page<WalletTransaction>>('/v1/wallet/transactions', { query: { filter, cursor: pageParam } }),
    ...pageParams,
  });

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: ['notifications'],
    enabled: signedIn(),
    queryFn: ({ pageParam }) =>
      api<Page<NotificationView>>('/v1/notifications', { query: { cursor: pageParam } }),
    ...pageParams,
  });

export const useUnreadCount = () => {
  const status = useSession((s) => s.status);
  return useQuery({
    queryKey: ['unread'],
    enabled: status === 'signedIn',
    refetchInterval: 60_000,
    queryFn: () => api<UnreadCount>('/v1/notifications/unread-count'),
  });
};

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') =>
      api<UnreadCount>(id === 'all' ? '/v1/notifications/read-all' : `/v1/notifications/${id}/read`, {
        method: 'POST',
      }),
    onSuccess: (count) => {
      qc.setQueryData(['unread'], count);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

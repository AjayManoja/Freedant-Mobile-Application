import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePublicUser, useWinner } from '@/api/hooks';
import { Loading } from '@/components/ui';
import { BottomNav } from '@/design/bottom-nav';
import { Card, CoverImage, inr, PersonAvatar, Press } from '@/design/components';
import { EmptyState, NoResultsArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import { ArrowLeft, Chevron, Star, Trophy } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { errorMessage, formatShortDate } from '@/lib/format';

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

/** US-29 — design/prototype/src/pages/WinnerProfilePage.tsx. */
export default function WinnerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const q = useWinner(userId);
  const user = usePublicUser(userId);

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return (
      <SafeAreaView style={tw`flex-1 bg-canvas items-center justify-center`}>
        <EmptyState
          illustration={<NoResultsArt />}
          title={t('common.somethingWrong')}
          message={errorMessage(q.error, t)}
          primary={{ label: t('common.retry'), onPress: () => void q.refetch() }}
          secondary={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }
  const w = q.data;
  const cover = w.placements.find((p) => p.competitionCoverUrl)?.competitionCoverUrl ?? null;
  const categories = w.placements.map((p) => p.categoryName).filter((c): c is string => !!c);
  const topTag = categories.sort(
    (a, b) => categories.filter((x) => x === b).length - categories.filter((x) => x === a).length,
  )[0];

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <ScrollView contentContainerStyle={tw`pb-28`} showsVerticalScrollIndicator={false}>
          <View style={tw`h-40`}>
            <CoverImage uri={cover} style={tw`absolute inset-0`} />
            <Gradient
              dir="b"
              colors={['rgba(27,43,58,0.6)', 'rgba(27,43,58,0.3)', color('canvas')]}
              style={tw`absolute inset-0`}
            />
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={tw`flex-row items-center gap-2 px-5 pt-4 self-start`}
            >
              <ArrowLeft color="#fff" />
              <T style={tw`text-white font-bold text-lg`}>{t('profile.title')}</T>
            </Pressable>
          </View>

          <View style={tw`px-4 -mt-14 gap-4`}>
            <View style={tw`items-center`}>
              <PersonAvatar
                uri={w.avatarUrl}
                name={w.displayName}
                index={0}
                size={96}
                style={[
                  tw`rounded-3xl`,
                  {
                    boxShadow: `0 0 0 4px ${color('canvas')}, 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)`,
                  },
                ]}
              />
              <View style={tw`mt-3 flex-row items-center gap-2`}>
                <T style={tw`text-2xl font-extrabold text-ink`} accessibilityRole="header">
                  {w.displayName}
                </T>
                {w.won > 0 ? (
                  <View
                    style={tw`flex-row items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 shadow-sm`}
                  >
                    <Trophy size={12} color="#fff" />
                    <T style={tw`text-[10px] font-bold text-white`}>{t('design.winner')}</T>
                  </View>
                ) : null}
              </View>
              {user.data?.bio ? (
                <T style={tw`text-sm text-ink/80 mt-2 max-w-[300px] leading-snug text-center`}>
                  {user.data.bio}
                </T>
              ) : null}
              {topTag ? (
                <View style={tw`mt-2 flex-row items-center gap-2`}>
                  <View style={tw`flex-row items-center gap-1 rounded-full bg-mint px-2.5 py-1`}>
                    <Star size={12} color={color('teal')} />
                    <T style={tw`text-[11px] font-semibold text-teal`}>{topTag}</T>
                  </View>
                </View>
              ) : null}
            </View>

            <Card style={tw`flex-row items-stretch overflow-hidden`}>
              <Stat icon={<Trophy color={color('teal')} />} value={String(w.won)} label={t('design.wins')} />
              <Stat
                icon={<Star color={color('teal')} />}
                value={String(w.joined)}
                label={t('design.entries')}
                divider
              />
              <Stat
                icon={<Star color={color('amber-400')} />}
                value={inr(w.totalWinningsPaise)}
                label={t('profile.winnings')}
                divider
              />
            </Card>

            <View>
              <T style={tw`font-bold text-ink mb-3 px-1`} accessibilityRole="header">
                {t('design.achievements')}
              </T>
              {w.placements.length === 0 ? (
                <Card style={tw`items-center`}>
                  <T style={tw`text-sm text-slate`}>{t('winner.empty')}</T>
                </Card>
              ) : (
                <View style={tw`gap-3`}>
                  {w.placements.map((p) => (
                    <Press
                      key={p.competitionId}
                      onPress={() => router.push(`/competition/${p.competitionId}`)}
                      accessibilityLabel={p.competitionTitle}
                      style={tw`w-full flex-row items-center gap-3 rounded-2xl bg-white p-3 shadow-sm`}
                    >
                      <CoverImage uri={p.competitionCoverUrl} style={tw`w-16 h-16 rounded-xl`} />
                      <View style={tw`flex-1 min-w-0`}>
                        <T style={tw`font-bold text-ink text-sm leading-tight`} numberOfLines={1}>
                          {p.competitionTitle}
                        </T>
                        <T style={tw`text-[11px] text-slate mt-0.5`}>
                          {[p.categoryName, formatShortDate(p.resultsPublishedAt)]
                            .filter(Boolean)
                            .join(' · ')}
                        </T>
                        <View style={tw`mt-1 flex-row items-center gap-2`}>
                          <View style={tw`flex-row items-center gap-1 rounded-md bg-mint px-1.5 py-0.5`}>
                            <Trophy size={12} color={color('teal')} />
                            <T style={tw`text-[10px] font-bold text-teal`}>
                              {t('design.place', { place: ordinal(p.rank) })}
                            </T>
                          </View>
                          {p.prizePaise > 0 ? (
                            <T style={tw`text-[11px] font-semibold text-teal`}>
                              {t('design.won', { amount: inr(p.prizePaise) })}
                            </T>
                          ) : null}
                        </View>
                      </View>
                      <Chevron color={color('slate')} rotate={-90} />
                    </Press>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
      <BottomNav active={null} />
    </SafeAreaView>
  );
}

function Stat({
  icon,
  value,
  label,
  divider,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <View style={[tw`flex-1 items-center gap-1 py-3.5`, divider && tw`border-l border-neutral-100`]}>
      {icon}
      <T style={tw`text-lg font-extrabold text-ink leading-none`} numberOfLines={1}>
        {value}
      </T>
      <T style={tw`text-[11px] text-slate`}>{label}</T>
    </View>
  );
}

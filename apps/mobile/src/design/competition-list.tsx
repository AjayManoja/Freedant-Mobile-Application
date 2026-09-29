import type { CountedPage, CompetitionSummary, ListQuery } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import type { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useCompetitions } from '@/api/hooks';
import { Loading } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { BottomNav } from './bottom-nav';
import { CompetitionRow } from './components';
import { EmptyState, NoNetworkArt, NoResultsArt } from './empty';
import { ArrowLeft } from './icons';
import { T } from './text';
import tw, { color } from './tw';

type Sort = 'popular' | 'prize' | 'ending';
const SORTS: Sort[] = ['popular', 'prize', 'ending'];

/**
 * pages/ListPage.tsx: a titled list with Popular / Top Prize / Ending Soon sort chips and
 * a count, used by "See all" lists and the Competitions tab.
 */
export function CompetitionList({
  title,
  icon,
  initialSort,
  query,
  back = true,
}: {
  title: string;
  icon: ReactNode;
  initialSort: Sort;
  query?: Omit<ListQuery, 'cursor' | 'limit' | 'sort'>;
  back?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [sort, setSort] = useState<Sort>(initialSort);
  const q = useCompetitions({ ...query, sort });
  const items = flatten(q.data);
  const total = (q.data as InfiniteData<CountedPage<CompetitionSummary>> | undefined)?.pages[0]?.total ?? items.length;

  const titleBar = (
    <View style={tw`flex-row items-center gap-2 px-5 pt-4 pb-3`}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
        disabled={!back}
        accessibilityRole={back ? 'button' : 'header'}
        accessibilityLabel={back ? t('common.back') : title}
        style={tw`flex-row items-center gap-2`}
      >
        {back ? <ArrowLeft color={color('ink')} /> : null}
        <View style={tw`flex-row items-center gap-1.5`}>
          {icon}
          <T style={tw`text-ink font-bold text-lg`}>{title}</T>
        </View>
      </Pressable>
    </View>
  );

  // space-y-4: sort chips, the count, then the rows.
  const header = (
    <View style={tw`gap-4 pb-4`}>
      <View style={tw`flex-row items-center gap-2`}>
        <T style={tw`text-xs text-slate`}>{t('design.sortBy')}</T>
        {SORTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => setSort(s)}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === s }}
            style={[tw`rounded-full px-3 py-1`, sort === s ? tw`bg-teal` : tw`bg-white shadow-sm`]}
          >
            <T style={tw`text-xs font-semibold ${sort === s ? 'text-white' : 'text-slate'}`}>{t(`design.sort.${s}`)}</T>
          </Pressable>
        ))}
      </View>
      <T style={tw`text-xs text-slate`}>{t('design.competitionsCount', { count: total })}</T>
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        {titleBar}
        <FlashList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <View style={tw`pb-3`}>
              <CompetitionRow c={item} />
            </View>
          )}
          ListHeaderComponent={header}
          contentContainerStyle={tw`px-4 pb-28`}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={color('teal')} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
          ListEmptyComponent={
            q.isPending ? (
              <Loading />
            ) : q.isError ? (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoNetworkArt />}
                title={t('design.loadFailed')}
                message={errorMessage(q.error, t)}
                primary={{ label: t('common.retry'), onPress: () => void q.refetch() }}
              />
            ) : (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoResultsArt />}
                title={t('design.noCompetitions')}
                message={t('design.noCompetitionsBody')}
                primary={{ label: t('design.exploreCompetitions'), onPress: () => router.push('/explore') }}
              />
            )
          }
        />
      </View>
      {/* As a tab it already has the tab bar; pushed "See all" lists belong to Explore. */}
      {back ? <BottomNav active="explore" /> : null}
    </SafeAreaView>
  );
}

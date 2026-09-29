import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompetitionSummary } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flatten, useCategories, useSearch } from '@/api/hooks';
import { useNetwork } from '@/api/network';
import { Loading } from '@/components/ui';
import { BottomNav } from '@/design/bottom-nav';
import { CompetitionRow, Press } from '@/design/components';
import { EmptyState, NoNetworkArt, NoResultsArt } from '@/design/empty';
import { ArrowLeft, Clock, Fire, Search, Trophy } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { RECENT_SEARCHES_KEY } from '@/lib/keys';

type Sort = 'relevance' | 'prize' | 'ending';
const SORTS: Sort[] = ['relevance', 'prize', 'ending'];
const TINTS = [
  { bg: 'bg-mint', fg: 'teal' },
  { bg: 'bg-amber-50', fg: 'amber-500' },
  { bg: 'bg-rose-50', fg: 'rose-400' },
  { bg: 'bg-indigo-50', fg: 'indigo-400' },
  { bg: 'bg-teal/10', fg: 'teal' },
  { bg: 'bg-neutral-100', fg: 'slate' },
];

/** US-10 — design/prototype/src/pages/SearchPage.tsx. Recent searches stay on the device. */
export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const input = useRef<TextInput>(null);
  const offline = useNetwork((s) => s.offline);
  const categories = useCategories();
  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState(query.trim());
  const [recent, setRecent] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('relevance');

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => setRecent(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => undefined);
    const id = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const searching = query.trim().length > 0;
  const results = useSearch(debounced);
  const items = useMemo(() => {
    const found = debounced.length >= 2 ? flatten(results.data) : [];
    const sorted = [...found];
    if (sort === 'prize') sorted.sort((a, b) => b.prizePoolPaise - a.prizePoolPaise);
    if (sort === 'ending') sorted.sort((a, b) => time(a) - time(b));
    return sorted;
  }, [results.data, debounced, sort]);

  const commit = (term: string) => {
    const value = term.trim();
    if (!value) return;
    setQuery(value);
    setRecent((prev) => {
      const next = [value, ...prev.filter((x) => x.toLowerCase() !== value.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };
  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => undefined);
  };

  const topCategories = [...(categories.data ?? [])].sort((a, b) => b.liveCount - a.liveCount).slice(0, 6);

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <View style={tw`flex-row items-center gap-2 px-4 pt-4 pb-3`}>
          <Press
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel={t('common.back')}
            scale={0.95}
            style={tw`w-9 h-9 rounded-full items-center justify-center`}
          >
            <ArrowLeft color={color('ink')} />
          </Press>
          <View style={tw`flex-1 flex-row items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-sm`}>
            <Search size={20} color={color('slate')} />
            <TextInput
              ref={input}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => commit(query)}
              placeholder={t('design.search')}
              placeholderTextColor={color('slate')}
              accessibilityLabel={t('design.search')}
              returnKeyType="search"
              style={[
                tw`min-w-0 flex-1 text-sm text-ink p-0`,
                { fontFamily: 'Poppins_400Regular', height: 20 },
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
              ]}
            />
            {searching ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('design.clearSearch')}
                hitSlop={8}
                style={tw`px-1`}
              >
                <T style={tw`text-lg leading-none text-slate`}>×</T>
              </Pressable>
            ) : null}
          </View>
        </View>

        {searching ? (
          <FlashList
            data={offline ? [] : items}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View style={tw`pb-3`}>
                <CompetitionRow c={item} />
              </View>
            )}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={tw`px-4 pb-28`}
            showsVerticalScrollIndicator={false}
            onEndReached={() =>
              results.hasNextPage && !results.isFetchingNextPage && void results.fetchNextPage()
            }
            ListHeaderComponent={
              <View style={tw`pb-4`}>
                <T style={tw`text-xs text-slate`}>
                  {t('design.resultsCount', { count: items.length, q: query.trim() })}
                </T>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={tw`mt-3 -mx-1`}
                  contentContainerStyle={tw`px-1 gap-2`}
                >
                  {SORTS.map((s) => {
                    const on = sort === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setSort(s)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[
                          tw`rounded-full px-3.5 py-2`,
                          on ? tw`bg-ink shadow-sm` : [tw`bg-white`, ring(1, color('neutral-200'))],
                        ]}
                      >
                        <T style={tw`text-xs font-semibold ${on ? 'text-white' : 'text-slate'}`}>
                          {t(`design.searchSort.${s}`)}
                        </T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              offline ? (
                <EmptyState
                  style={tw`py-14`}
                  illustration={<NoNetworkArt />}
                  title={t('design.offlineTitle')}
                  message={t('design.offlineSearch')}
                  primary={{ label: t('common.retry'), onPress: () => void results.refetch() }}
                />
              ) : debounced.length < 2 || results.isPending ? (
                debounced.length >= 2 ? (
                  <Loading />
                ) : (
                  <T style={tw`text-xs text-slate`}>{t('explore.searchHint')}</T>
                )
              ) : (
                <EmptyState
                  style={tw`py-14`}
                  illustration={<NoResultsArt />}
                  title={t('design.noResultsFor', { q: query.trim() })}
                  message={t('design.noResultsBody')}
                  primary={{ label: t('design.clearSearch'), onPress: () => setQuery('') }}
                  secondary={{
                    label: t('design.exploreCompetitions'),
                    onPress: () => router.push('/explore'),
                  }}
                />
              )
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={tw`px-4 pb-28`}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {recent.length > 0 ? (
              <View>
                <View style={tw`flex-row items-center justify-between`}>
                  <T style={tw`font-bold text-ink`} accessibilityRole="header">
                    {t('design.recent')}
                  </T>
                  <Pressable onPress={clearRecent} accessibilityRole="button" hitSlop={8}>
                    <T style={tw`text-xs font-semibold text-teal`}>{t('design.clear')}</T>
                  </Pressable>
                </View>
                <View style={tw`mt-3 gap-1`}>
                  {recent.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => commit(r)}
                      accessibilityRole="button"
                      accessibilityLabel={r}
                      style={({ pressed }) => [
                        tw`flex-row w-full items-center gap-3 rounded-xl px-2 py-2.5`,
                        pressed && tw`bg-neutral-100`,
                      ]}
                    >
                      <View style={tw`h-8 w-8 items-center justify-center rounded-lg bg-neutral-100`}>
                        <Clock color={color('slate')} />
                      </View>
                      <T style={tw`flex-1 text-sm text-ink`} numberOfLines={1}>
                        {r}
                      </T>
                      <Search size={16} color={color('slate')} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={tw`mt-6`}>
              <T style={tw`font-bold text-ink`} accessibilityRole="header">
                {t('design.suggested')}
              </T>
              <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
                {(categories.data ?? []).map((c) => (
                  <Press
                    key={c.id}
                    onPress={() => commit(c.name)}
                    scale={0.95}
                    style={tw`rounded-full bg-white px-4 py-2 shadow-sm`}
                  >
                    <T style={tw`text-sm font-semibold text-slate`}>{c.name}</T>
                  </Press>
                ))}
              </View>
            </View>

            {topCategories.length > 0 ? (
              <View style={tw`mt-6`}>
                <T style={tw`font-bold text-ink`} accessibilityRole="header">
                  {t('design.browseCategoriesLower')}
                </T>
                <View style={tw`mt-3 flex-row flex-wrap gap-3`}>
                  {topCategories.map((c, i) => {
                    const tint = TINTS[i % TINTS.length]!;
                    return (
                      <Press
                        key={c.id}
                        onPress={() => router.push({ pathname: '/explore', params: { category: c.slug } })}
                        scale={0.98}
                        accessibilityLabel={c.name}
                        style={[
                          tw`flex-row items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm`,
                          { width: '48.4%' },
                        ]}
                      >
                        <View style={tw`h-10 w-10 items-center justify-center rounded-xl ${tint.bg}`}>
                          {i % 2 === 0 ? (
                            <Fire size={20} color={color(tint.fg)} />
                          ) : (
                            <Trophy size={20} color={color(tint.fg)} />
                          )}
                        </View>
                        <View style={tw`min-w-0 flex-1`}>
                          <T style={tw`text-sm font-bold text-ink leading-tight`} numberOfLines={1}>
                            {c.name}
                          </T>
                          <T style={tw`text-[11px] text-slate`}>
                            {t('design.contestsCount', { count: c.liveCount ?? 0 })}
                          </T>
                        </View>
                      </Press>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
      <BottomNav active={null} />
    </SafeAreaView>
  );
}

const time = (c: CompetitionSummary) =>
  c.registrationClosesAt ? new Date(c.registrationClosesAt).getTime() : Number.MAX_SAFE_INTEGER;

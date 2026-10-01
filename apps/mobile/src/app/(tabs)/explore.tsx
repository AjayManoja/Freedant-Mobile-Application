import type { CategoryListing, CompetitionSummary } from '@feedants/shared';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { flatten, useCategories, useCompetitions, useHome, useSearch, useUnreadCount } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { Loading } from '@/design/loading';
import { categoryStyle } from '@/design/categories';
import { Card, CompetitionRow, CoverImage, inr, Press, SectionHeader } from '@/design/components';
import { Gradient } from '@/design/gradient';
import { Bell, Fire, Search, Star, Trophy, Users } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';

/** US-09, US-10 — design/prototype/src/pages/ExplorePage.tsx. */
export default function Explore() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const categories = useCategories();
  const [active, setActive] = useState<string | null>(params.category ?? null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (params.category) setActive(params.category);
  }, [params.category]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const searching = query.trim().length > 0;
  const activeCategory = categories.data?.find((c) => c.slug === active) ?? null;

  const header = (
    <View style={tw`gap-5 pb-5`}>
      <View style={tw`flex-row items-center gap-2 rounded-xl bg-white shadow-sm px-4 py-3`}>
        <Search size={20} color={color('slate')} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('design.search')}
          placeholderTextColor={color('slate')}
          accessibilityLabel={t('design.search')}
          returnKeyType="search"
          style={[
            tw`flex-1 min-w-0 text-sm text-ink p-0`,
            { fontFamily: 'Poppins_400Regular', height: 20 },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          ]}
        />
        {searching ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel={t('design.clearSearch')}
            hitSlop={8}
            style={tw`px-1`}
          >
            <T style={tw`text-slate text-lg leading-none`}>×</T>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={tw`-mx-1`}
        contentContainerStyle={tw`px-1 gap-2`}
      >
        {[
          { slug: null, name: t('design.all') } as { slug: string | null; name: string },
          ...(categories.data ?? []),
        ].map((c) => {
          const on = active === c.slug;
          return (
            <Pressable
              key={c.slug ?? 'all'}
              onPress={() => setActive(c.slug)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[tw`rounded-full px-4 py-1.5`, on ? tw`bg-teal` : tw`bg-white shadow-sm`]}
            >
              <T style={tw`text-sm font-semibold ${on ? 'text-white' : 'text-slate'}`}>{c.name}</T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <ExploreHeader />
        {searching || activeCategory ? (
          <Results
            header={header}
            title={
              searching
                ? t('design.resultsFor', { q: query.trim() })
                : t('design.categoryCompetitions', { name: activeCategory!.name })
            }
            query={searching ? debounced : null}
            category={searching ? null : active}
            onReset={() => {
              setQuery('');
              setActive(null);
            }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={tw`px-4 pb-28`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {header}
            <BrowseView
              categories={categories.data ?? []}
              onCategory={setActive}
              onSeeAll={(type) => router.push({ pathname: '/explore/[type]', params: { type } })}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function ExploreHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const unread = useUnreadCount();
  return (
    <View style={tw`flex-row items-center justify-between px-5 pt-4 pb-3`}>
      <View>
        <T style={tw`text-slate text-xs`}>{t('design.discover')}</T>
        <T style={tw`text-2xl font-extrabold text-ink leading-tight`} accessibilityRole="header">
          {t('design.explore')}
        </T>
      </View>
      {signedIn ? (
        <Press
          onPress={() => router.push('/notifications')}
          accessibilityLabel={t('notifications.title')}
          scale={0.95}
          style={tw`w-10 h-10 rounded-full bg-white shadow-sm items-center justify-center`}
        >
          <Bell size={20} color={color('ink')} />
          {(unread.data?.unread ?? 0) > 0 ? (
            <View style={tw`absolute top-2 right-2 w-2 h-2 rounded-full bg-teal`} />
          ) : null}
        </Press>
      ) : null}
    </View>
  );
}

function BrowseView({
  categories,
  onCategory,
  onSeeAll,
}: {
  categories: CategoryListing[];
  onCategory: (slug: string) => void;
  onSeeAll: (type: 'trending' | 'ending') => void;
}) {
  const { t } = useTranslation();
  const home = useHome();
  if (home.isPending) return <Loading />;
  const h = home.data;
  const banners = (h?.topPrize ?? []).slice(0, 3);

  return (
    <View style={tw`gap-5`}>
      {banners.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="center"
          decelerationRate="fast"
          style={tw`-mx-4`}
          contentContainerStyle={tw`px-4 gap-3`}
        >
          {banners.map((c, i) => (
            <Banner key={c.id} c={c} theme={THEMES[i % THEMES.length]!} />
          ))}
        </ScrollView>
      ) : null}

      {h && h.trending.length > 0 ? (
        <View>
          <SectionHeader
            title={t('design.trendingNow')}
            action={t('design.seeAll')}
            onAction={() => onSeeAll('trending')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={tw`-mx-1`}
            contentContainerStyle={tw`px-1 gap-3`}
          >
            {h.trending.map((c) => (
              <TrendingCard key={c.id} c={c} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View>
          <SectionHeader title={t('design.browseCategories')} />
          <View style={tw`flex-row flex-wrap gap-3`}>
            {categories.map((c) => {
              const s = categoryStyle(c.slug);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onCategory(c.slug)}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  style={{ width: '48.4%' }}
                >
                  {/* Card p-5 wins over the design's p-4 (measured: 84px tall). */}
                  <Card style={tw`flex-row items-center gap-3`}>
                    <View style={tw`w-11 h-11 rounded-xl items-center justify-center ${s.bg}`}>
                      {s.icon(color(s.fg))}
                    </View>
                    <View style={tw`flex-1 min-w-0`}>
                      <T style={tw`font-bold text-ink text-sm`} numberOfLines={1}>
                        {c.name}
                      </T>
                      <T style={tw`text-xs text-slate`}>
                        {t('design.liveCount', { count: c.liveCount ?? 0 })}
                      </T>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {h && h.endingSoon.length > 0 ? (
        <View>
          <SectionHeader
            title={t('design.endingSoon')}
            action={t('design.seeAll')}
            onAction={() => onSeeAll('ending')}
          />
          <View style={tw`gap-3`}>
            {h.endingSoon.map((c) => (
              <CompetitionRow key={c.id} c={c} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- themed banners

type Theme = { key: 'fest' | 'dance' | 'code'; icon: (c: string) => ReactNode };
const THEMES: Theme[] = [
  { key: 'fest', icon: (c) => <Trophy size={14} color={c} /> },
  { key: 'dance', icon: (c) => <Fire size={14} color={c} /> },
  { key: 'code', icon: (c) => <Star size={14} color={c} /> },
];

/** ExplorePage `bannerThemes`: each banner has its own surface and motif. */
function Surface({ theme, children }: { theme: Theme['key']; children: ReactNode }) {
  const box = tw`rounded-2xl p-5 overflow-hidden`;
  if (theme === 'fest') {
    return (
      <Gradient dir="br" colors={[color('teal'), '#0b6b63']} style={box}>
        <View
          style={[
            tw`absolute -right-10 -top-12 w-44 h-44 rounded-full`,
            { backgroundColor: 'rgba(255,210,48,0.2)' },
          ]}
        />
        <View
          style={[
            tw`absolute right-6 top-8 w-2 h-2`,
            { backgroundColor: 'rgba(254,230,133,0.7)', transform: [{ rotate: '45deg' }] },
          ]}
        />
        <View style={tw`absolute right-16 top-16 w-1.5 h-1.5 rounded-full bg-white/70`} />
        <View
          style={[tw`absolute right-10 bottom-6 w-3 h-3 bg-white/40`, { transform: [{ rotate: '12deg' }] }]}
        />
        <View
          style={[
            tw`absolute right-24 bottom-10 w-1.5 h-1.5 rounded-full`,
            { backgroundColor: 'rgba(254,230,133,0.8)' },
          ]}
        />
        {children}
      </Gradient>
    );
  }
  if (theme === 'dance') {
    return (
      <Gradient dir="tr" colors={['#7c2d8f', '#a1327f', '#e0558a']} style={box}>
        <View
          style={[
            tw`absolute -right-16 -bottom-16 w-56 h-56 rounded-full`,
            { borderWidth: 14, borderColor: 'rgba(255,255,255,0.15)' },
          ]}
        />
        <View
          style={[
            tw`absolute -right-6 -top-10 w-32 h-32 rounded-full`,
            { borderWidth: 10, borderColor: 'rgba(255,255,255,0.1)' },
          ]}
        />
        {children}
      </Gradient>
    );
  }
  return (
    <View style={[box, { backgroundColor: '#0f1b2a' }]}>
      <Svg style={[tw`absolute inset-0`, { opacity: 0.18 }]} width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width={22} height={22} patternUnits="userSpaceOnUse">
            <Path d="M0.5 0V22M0 0.5H22" stroke="#4fd1c5" strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
      <T
        style={[
          tw`absolute right-4 top-4 text-[10px] leading-relaxed`,
          {
            color: 'rgba(13,128,116,0.7)',
            fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
          },
        ]}
      >
        {'{ }\n</>'}
      </T>
      {children}
    </View>
  );
}

function Banner({ c, theme }: { c: CompetitionSummary; theme: Theme }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // w-[86%] of the scroller's content box (the 430px column less its 16px gutters).
  return (
    <View style={{ width: (Math.min(width, 430) - 32) * 0.86 }}>
      <Surface theme={theme.key}>
        <View style={tw`self-start flex-row items-center gap-1 rounded-full bg-white/20 px-2.5 py-1`}>
          {theme.icon('#fff')}
          <T style={tw`text-[11px] font-semibold text-white`}>
            {c.category ? `${c.category.name} · ${t(`phase.${c.phase}`)}` : t(`phase.${c.phase}`)}
          </T>
        </View>
        <T style={tw`mt-3 text-xl font-extrabold leading-snug text-white`} numberOfLines={1}>
          {c.title}
        </T>
        <T style={tw`text-sm text-white/85 mt-1`} numberOfLines={1}>
          {t('design.bannerSub', { prize: inr(c.prizePoolPaise), spots: c.spotsRemaining })}
        </T>
        <Press
          onPress={() => router.push(`/competition/${c.id}`)}
          style={tw`mt-4 self-start rounded-lg bg-white px-4 py-2`}
        >
          <T style={tw`text-ink text-sm font-semibold`}>
            {c.entryFeePaise === 0 ? t('design.enterFree') : t('design.joinNow')}
          </T>
        </Press>
      </Surface>
    </View>
  );
}

function TrendingCard({ c }: { c: CompetitionSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Press
      onPress={() => router.push(`/competition/${c.id}`)}
      accessibilityLabel={c.title}
      scale={1}
      style={tw`w-[220px] rounded-2xl bg-white shadow-sm overflow-hidden`}
    >
      <View style={tw`h-28`}>
        <CoverImage uri={c.coverUrl} style={tw`absolute inset-0`} />
        {c.category ? (
          <View style={tw`absolute top-2 left-2 rounded-md bg-black/45 px-2 py-0.5`}>
            <T style={tw`text-white text-[11px] font-medium`}>{c.category.name}</T>
          </View>
        ) : null}
        <View
          style={tw`absolute top-2 right-2 flex-row items-center gap-1 rounded-md bg-white/90 px-2 py-0.5`}
        >
          <Users color={color('teal')} />
          <T style={tw`text-teal text-[11px] font-semibold`}>{c.participants}</T>
        </View>
      </View>
      <View style={tw`p-3`}>
        <T style={tw`font-bold text-ink text-sm leading-tight`}>{c.title}</T>
        <View style={tw`mt-2 flex-row items-center justify-between`}>
          <View>
            <T style={tw`text-[10px] text-slate`}>{t('design.prizePool')}</T>
            <T style={tw`text-teal font-extrabold`}>{inr(c.prizePoolPaise)}</T>
          </View>
          <View style={tw`items-end`}>
            <T style={tw`text-[10px] text-slate`}>{t('design.entry')}</T>
            <T style={tw`text-ink font-bold text-sm`}>
              {c.entryFeePaise === 0 ? t('common.free') : inr(c.entryFeePaise)}
            </T>
          </View>
        </View>
        <T style={tw`mt-2 text-[11px] text-teal font-semibold`}>
          {t('design.spotsLeft', { count: c.spotsRemaining })}
        </T>
      </View>
    </Press>
  );
}

// ---------------------------------------------------------------- filtered results

function Results({
  header,
  title,
  query,
  category,
  onReset,
}: {
  header: ReactNode;
  title: string;
  query: string | null;
  category: string | null;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const search = useSearch(query ?? '');
  const list = useCompetitions({ category: category ?? undefined, sort: 'popular' });
  const active = query !== null ? search : list;
  const items = query !== null && query.length < 2 ? [] : flatten(active.data);
  const pending = query !== null ? query.length >= 2 && search.isPending : list.isPending;

  return (
    <FlashList
      data={items}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <View style={tw`pb-3`}>
          <CompetitionRow c={item} />
        </View>
      )}
      ListHeaderComponent={
        <View>
          {header}
          <SectionHeader title={title} />
        </View>
      }
      contentContainerStyle={tw`px-4 pb-28`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReached={() => active.hasNextPage && !active.isFetchingNextPage && void active.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        pending ? (
          <Loading />
        ) : (
          <Card style={tw`items-center py-10 gap-2`}>
            <Search size={32} color={color('slate')} />
            <T style={tw`font-bold text-ink`}>{t('design.noneFound')}</T>
            <T style={tw`text-sm text-slate text-center`}>
              {query !== null && query.length < 2 ? t('explore.searchHint') : t('design.noneFoundBody')}
            </T>
            <Press onPress={onReset} style={tw`mt-2 rounded-lg bg-teal px-4 py-2`}>
              <T style={tw`text-white text-sm font-semibold`}>{t('explore.reset')}</T>
            </Press>
          </Card>
        )
      }
    />
  );
}

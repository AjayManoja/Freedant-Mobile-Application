import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CompetitionList } from '@/design/competition-list';
import { Clock, Fire } from '@/design/icons';
import { color } from '@/design/tw';

/** pages/ListPage.tsx: "See all" for Trending Now and Ending Soon. */
export default function ExploreList() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { t } = useTranslation();
  if (type === 'ending') {
    return (
      <CompetitionList
        title={t('design.endingSoon')}
        icon={<Clock color={color('teal')} />}
        initialSort="ending"
        query={{ phase: 'OPEN' }}
      />
    );
  }
  return (
    <CompetitionList
      title={t('design.trendingNow')}
      icon={<Fire size={16} color={color('teal')} />}
      initialSort="popular"
    />
  );
}

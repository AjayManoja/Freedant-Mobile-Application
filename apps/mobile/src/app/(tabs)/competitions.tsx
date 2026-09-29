import { useTranslation } from 'react-i18next';
import { CompetitionList } from '@/design/competition-list';
import { Trophy } from '@/design/icons';
import { color } from '@/design/tw';

/** SCOPE screen inventory: the Competitions tab is the full list, same component as Explore's lists. */
export default function CompetitionsTab() {
  const { t } = useTranslation();
  return (
    <CompetitionList
      title={t('tabs.competitions')}
      icon={<Trophy size={16} color={color('teal')} />}
      initialSort="popular"
      back={false}
    />
  );
}

import type { JudgingEntry } from '@feedants/shared';
import { scoreSchema } from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { publishResults, scoreEntry, useCompetition, useEntries } from '@/api/hooks';
import { MediaPreview } from '@/components/media';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  Header,
  Loading,
  Notice,
  ProgressBar,
  Row,
  Screen,
} from '@/components/ui';
import { errorMessage, formatDateTime } from '@/lib/format';
import { space } from '@/theme/tokens';

/** US-27 (score every entry) and US-28 (publish results). Host only; the API enforces it. */
export default function JudgeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const competition = useCompetition(id);
  const entries = useEntries(id);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entries.isPending) return <Loading />;
  if (entries.isError) {
    return (
      <Screen>
        <Header title={t('judge.title')} onBack={() => router.back()} />
        <ErrorState
          message={errorMessage(entries.error, t)}
          requestId={entries.error instanceof ApiError ? entries.error.requestId : undefined}
          onRetry={() => void entries.refetch()}
        />
      </Screen>
    );
  }

  const list = entries.data;
  const scored = list.filter((e) => e.score !== null).length;
  const judging = competition.data?.phase === 'JUDGING';

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await publishResults(id);
      setConfirming(false);
      for (const key of ['competition', 'hosted', 'home', 'wallet', 'leaderboard'])
        void qc.invalidateQueries({ queryKey: [key] });
      router.replace(`/competition/${id}/leaderboard`);
    } catch (e) {
      setConfirming(false);
      setError(errorMessage(e, t));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        list.length > 0 || judging ? (
          <Button
            title={t('judge.publish')}
            icon="podium-outline"
            disabled={!judging || scored < list.length}
            onPress={() => setConfirming(true)}
          />
        ) : null
      }
    >
      <Header title={t('judge.title')} onBack={() => router.back()} />
      {competition.data ? <AppText variant="heading">{competition.data.title}</AppText> : null}
      {competition.data && !judging ? (
        <Notice tone="warning" icon="time-outline" text={t('judge.notYet')} />
      ) : null}
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      {list.length === 0 ? (
        <EmptyState icon="file-tray-outline" text={t('judge.empty')} />
      ) : (
        <View style={styles.gap}>
          <AppText variant="label">{t('judge.scored', { scored, total: list.length })}</AppText>
          <ProgressBar value={scored / list.length} />
        </View>
      )}

      {list.map((e) => (
        <EntryCard key={e.submissionId} entry={e} competitionId={id} disabled={!judging} />
      ))}

      <ConfirmSheet
        visible={confirming}
        title={t('judge.publish')}
        message={t('judge.publishConfirm')}
        confirm={t('judge.publish')}
        busy={publishing}
        onConfirm={() => void publish()}
        onClose={() => setConfirming(false)}
      />
    </Screen>
  );
}

function EntryCard({
  entry,
  competitionId,
  disabled,
}: {
  entry: JudgingEntry;
  competitionId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [score, setScore] = useState(entry.score === null ? '' : String(entry.score));
  const [comment, setComment] = useState(entry.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = scoreSchema.safeParse({ score: Number(score), comment: comment.trim() || null });
  const valid = score.trim() !== '' && parsed.success;
  const dirty =
    score !== (entry.score === null ? '' : String(entry.score)) || comment !== (entry.comment ?? '');

  const save = async () => {
    if (!parsed.success) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await scoreEntry(entry.submissionId, parsed.data.score, parsed.data.comment ?? null);
      qc.setQueryData<JudgingEntry[]>(['entries', competitionId], (old) =>
        old?.map((e) => (e.submissionId === saved.submissionId ? saved : e)),
      );
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Row>
        <Avatar uri={entry.creator.avatarUrl} name={entry.creator.displayName} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{entry.creator.displayName}</AppText>
          <AppText variant="caption">{formatDateTime(entry.submittedAt)}</AppText>
        </View>
        {entry.score !== null ? (
          <Badge
            label={t('judge.scoredBadge', { score: entry.score })}
            tone="success"
            icon="checkmark-circle"
          />
        ) : null}
      </Row>
      {entry.mediaUrl ? (
        <MediaPreview url={entry.mediaUrl} kind={entry.mediaType} />
      ) : (
        <AppText variant="caption">{t('judge.noMedia')}</AppText>
      )}
      {entry.caption ? <AppText variant="body">{entry.caption}</AppText> : null}
      <Field
        label={t('judge.score')}
        keyboardType="decimal-pad"
        value={score}
        onChangeText={(v) => setScore(v.replace(',', '.').replace(/[^\d.]/g, ''))}
        editable={!disabled}
        error={score.trim() !== '' && !valid ? t('judge.scoreInvalid') : null}
      />
      <Field
        label={t('judge.comment')}
        value={comment}
        onChangeText={setComment}
        editable={!disabled}
        multiline
      />
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      <Button
        title={t('judge.saveScore')}
        kind="secondary"
        onPress={() => void save()}
        disabled={disabled || !valid || !dirty}
        loading={saving}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.xs },
});

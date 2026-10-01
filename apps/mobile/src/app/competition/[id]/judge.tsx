import type { JudgingEntry } from '@feedants/shared';
import { scoreSchema } from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publishResults, scoreEntry, useCompetition, useEntries } from '@/api/hooks';
import { MediaPreview } from '@/components/media';
import { Loading } from '@/design/loading';
import { BackHeader, BottomSheet, ConfirmDialog, PersonAvatar, SheetButton } from '@/design/components';
import { EmptyState, NoEntriesArt, NoNetworkArt } from '@/design/empty';
import { Chevron, Star } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatWhen } from '@/lib/format';

/**
 * US-27 (score every entry) and US-28 (publish results) — the prototype's EntriesSheet
 * (MyCompetitionsPage.tsx) as a page: ranked entry rows, a mint progress bar and a
 * sticky publish button. Host only; the API enforces it.
 */
export default function JudgeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const competition = useCompetition(id);
  const entries = useEntries(id);
  const [open, setOpen] = useState<JudgingEntry | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entries.isPending) return <Loading />;

  const c = competition.data;
  const list = entries.data ?? [];
  const scored = list.filter((e) => e.score !== null).length;
  const judging = c?.phase === 'JUDGING';
  const ready = judging && list.length > 0 && scored === list.length;

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
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader subtitle={c?.title} title={t('judge.title')} />
        {entries.isError ? (
          <EmptyState
            style={tw`flex-1`}
            illustration={<NoNetworkArt />}
            title={t('common.somethingWrong')}
            message={errorMessage(entries.error, t)}
            primary={{ label: t('common.retry'), onPress: () => void entries.refetch() }}
          />
        ) : (
          <ScrollView contentContainerStyle={tw`px-4 pt-2 pb-6 gap-2.5`} showsVerticalScrollIndicator={false}>
            {c && !judging ? (
              <View style={tw`rounded-xl bg-amber-50 px-3.5 py-2.5`}>
                <T style={tw`text-xs font-semibold text-amber-700`}>{t('judge.notYet')}</T>
              </View>
            ) : null}
            {error ? (
              <View style={tw`rounded-xl bg-rose-50 px-3.5 py-2.5`} accessibilityLiveRegion="polite">
                <T style={tw`text-xs font-semibold text-rose-500`}>{error}</T>
              </View>
            ) : null}
            {list.length > 0 ? (
              <View style={tw`rounded-xl bg-mint px-3.5 py-2.5 mb-1.5`}>
                <T style={tw`text-xs font-semibold text-teal`}>
                  {t('judge.progress', { scored, total: list.length })}
                </T>
                <View style={tw`mt-2 h-1.5 rounded-full bg-white overflow-hidden`}>
                  <View
                    style={[tw`h-full rounded-full bg-teal`, { width: `${(scored / list.length) * 100}%` }]}
                  />
                </View>
              </View>
            ) : (
              <EmptyState
                style={tw`py-14`}
                illustration={<NoEntriesArt />}
                title={t('judge.emptyTitle')}
                message={t('judge.empty')}
              />
            )}
            {list.map((e, i) => (
              <EntryRow key={e.submissionId} entry={e} index={i} onPress={() => setOpen(e)} />
            ))}
          </ScrollView>
        )}

        {list.length > 0 ? (
          <View style={[tw`border-t bg-canvas px-4 pt-3 pb-4`, { borderColor: 'rgba(229,229,229,0.7)' }]}>
            <Pressable
              onPress={() => setConfirming(true)}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              style={({ pressed }) => [
                tw`w-full rounded-xl py-3.5 items-center`,
                ready ? tw`bg-teal shadow-sm` : tw`bg-neutral-200`,
                pressed && ready && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <T style={tw`text-sm font-bold ${ready ? 'text-white' : 'text-slate'}`}>
                {ready ? t('judge.publish') : judging ? t('judge.scoreAll') : t('judge.publish')}
              </T>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScoreSheet entry={open} competitionId={id} disabled={!judging} onClose={() => setOpen(null)} />
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={t('judge.publish')}
        message={t('judge.publishConfirm')}
        cancel={t('common.cancel')}
        confirm={t('judge.publishShort')}
        busy={publishing}
        onConfirm={() => void publish()}
        onClose={() => !publishing && setConfirming(false)}
      />
    </SafeAreaView>
  );
}

/** EntriesSheet row: avatar with its number, name, kind, submitted time, and the score. */
function EntryRow({ entry, index, onPress }: { entry: JudgingEntry; index: number; onPress: () => void }) {
  const { t } = useTranslation();
  const scored = entry.score !== null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.creator.displayName}, ${scored ? t('judge.scoredBadge', { score: entry.score }) : t('judge.tapToScore')}`}
      style={({ pressed }) => [
        tw`flex-row items-center gap-3 w-full rounded-2xl bg-white p-3 shadow-sm`,
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={tw`shrink-0`}>
        <PersonAvatar
          uri={entry.creator.avatarUrl}
          name={entry.creator.displayName}
          index={index}
          size={44}
          style={tw`rounded-xl`}
        />
        <View style={tw`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-ink items-center justify-center`}>
          <T style={tw`text-[10px] font-bold text-white leading-none`}>{index + 1}</T>
        </View>
      </View>
      <View style={tw`flex-1 min-w-0`}>
        <T style={tw`font-bold text-ink text-sm`} numberOfLines={1}>
          {entry.creator.displayName}
        </T>
        <T style={tw`text-xs text-slate`} numberOfLines={1}>
          {entry.mediaType ? t(`mySubs.kind.${entry.mediaType}`) : t('judge.noMedia')}
          {entry.caption ? ` · ${entry.caption}` : ''}
        </T>
        <T style={tw`text-[11px] text-slate mt-0.5`}>
          {t('mySubs.submittedAt', { when: formatWhen(entry.submittedAt, t) })}
        </T>
      </View>
      <View style={tw`shrink-0 items-end`}>
        {scored ? (
          <View style={tw`flex-row items-center gap-1`}>
            <Star size={14} color={color('amber-400')} />
            <T style={tw`text-xs font-bold text-ink`}>{entry.score}</T>
          </View>
        ) : (
          <T style={tw`text-[11px] text-slate`}>{t('judge.tapToScore')}</T>
        )}
        <View style={tw`mt-1`}>
          <Chevron size={16} color={color('slate')} rotate={-90} />
        </View>
      </View>
    </Pressable>
  );
}

const QUICK_SCORES = [6, 7, 8, 9, 10];

/** Scores one entry: its media and caption, a 0–10 score (one decimal) and an optional comment. */
function ScoreSheet({
  entry,
  competitionId,
  disabled,
  onClose,
}: {
  entry: JudgingEntry | null;
  competitionId: string;
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={!!entry} onClose={onClose}>
      {entry ? (
        <ScoreForm
          key={entry.submissionId}
          entry={entry}
          competitionId={competitionId}
          disabled={disabled}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function ScoreForm({
  entry,
  competitionId,
  disabled,
  onDone,
}: {
  entry: JudgingEntry;
  competitionId: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [score, setScore] = useState(entry.score === null ? '' : String(entry.score));
  const [comment, setComment] = useState(entry.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = scoreSchema.safeParse({ score: Number(score), comment: comment.trim() || null });
  const valid = score.trim() !== '' && parsed.success;

  const save = async () => {
    if (!parsed.success) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await scoreEntry(entry.submissionId, parsed.data.score, parsed.data.comment ?? null);
      qc.setQueryData<JudgingEntry[]>(['entries', competitionId], (old) =>
        old?.map((e) => (e.submissionId === saved.submissionId ? saved : e)),
      );
      onDone();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  };

  const input = [
    tw`rounded-xl bg-white px-3.5 py-3 text-sm text-ink`,
    ring(1, color('neutral-200')),
    { fontFamily: 'Poppins_400Regular' },
    Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
  ];

  return (
    <ScrollView style={tw`mt-3`} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={tw`flex-row items-center justify-between`}>
        <View style={tw`min-w-0 flex-1`}>
          <T style={tw`text-lg font-extrabold text-ink`} numberOfLines={1} accessibilityRole="header">
            {entry.creator.displayName}
          </T>
          <T style={tw`text-xs text-slate`}>
            {t('mySubs.submittedAt', { when: formatWhen(entry.submittedAt, t) })}
          </T>
        </View>
        <Pressable onPress={onDone} accessibilityRole="button" hitSlop={8}>
          <T style={tw`text-slate text-sm font-semibold`}>{t('common.close')}</T>
        </Pressable>
      </View>

      <View style={tw`mt-4 gap-3`}>
        {entry.mediaUrl ? (
          <MediaPreview url={entry.mediaUrl} kind={entry.mediaType} />
        ) : (
          <T style={tw`text-xs text-slate`}>{t('judge.noMedia')}</T>
        )}
        {entry.caption ? <T style={tw`text-sm text-ink leading-relaxed`}>{entry.caption}</T> : null}

        <View>
          <T style={tw`text-xs font-semibold text-slate mb-1.5`}>{t('judge.score')}</T>
          <View style={tw`flex-row gap-2`}>
            <TextInput
              value={score}
              onChangeText={(v) => setScore(v.replace(',', '.').replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              editable={!disabled}
              placeholder="–"
              placeholderTextColor={color('slate')}
              accessibilityLabel={t('judge.score')}
              style={[...input, tw`w-20 text-center font-bold`, { fontFamily: 'Poppins_700Bold' }]}
            />
            {QUICK_SCORES.map((n) => {
              const on = Number(score) === n && score !== '';
              return (
                <Pressable
                  key={n}
                  onPress={() => setScore(String(n))}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    tw`flex-1 rounded-xl items-center justify-center`,
                    on ? tw`bg-teal` : [tw`bg-white`, ring(1, color('neutral-200'))],
                  ]}
                >
                  <T style={tw`text-sm font-bold ${on ? 'text-white' : 'text-ink'}`}>{n}</T>
                </Pressable>
              );
            })}
          </View>
          {score.trim() !== '' && !valid ? (
            <T style={tw`mt-1.5 text-[11px] text-rose-500`}>{t('judge.scoreInvalid')}</T>
          ) : null}
        </View>

        <View>
          <T style={tw`text-xs font-semibold text-slate mb-1.5`}>{t('judge.comment')}</T>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!disabled}
            multiline
            textAlignVertical="top"
            placeholder={t('judge.commentPlaceholder')}
            placeholderTextColor={color('slate')}
            accessibilityLabel={t('judge.comment')}
            style={[...input, tw`min-h-20`]}
          />
        </View>

        {error ? (
          <View style={tw`rounded-xl bg-rose-50 px-3.5 py-2.5`}>
            <T style={tw`text-xs font-semibold text-rose-500`}>{error}</T>
          </View>
        ) : null}

        <SheetButton
          title={t('judge.saveScore')}
          onPress={() => void save()}
          disabled={disabled || !valid}
          loading={saving}
        />
      </View>
    </ScrollView>
  );
}

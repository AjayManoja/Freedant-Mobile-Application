import {
  defaultRules,
  type SubmissionUpdateInput,
  type SubmissionView,
  submissionChecklist,
} from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { mediaUploadUrl, submitEntry, updateSubmission, useCompetition, useSubmission } from '@/api/hooks';
import { serverNow, syncServerClock, useNow } from '@/components/competition';
import { MediaPreview } from '@/components/media';
import { Loading } from '@/design/loading';
import { BackHeader, CoverImage, inr, Press, SheetButton, StatusPill } from '@/design/components';
import { EmptyState, NoNetworkArt } from '@/design/empty';
import { Camera, Chat, CheckCircle, Clock, Lock, Play, Shield, Trophy, Upload } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatDateTime, formatDuration, formatWhen } from '@/lib/format';
import { type PickedFile, pickAudio, pickImage, pickVideo, uploadToStorage } from '@/media/media';

const CAPTION_SAVE_DELAY_MS = 800;

const STATUS_TINT: Record<SubmissionView['displayStatus'], string> = {
  WON: 'bg-amber-50 text-amber-600',
  DRAFT: 'bg-mint text-teal',
  IN_REVIEW: 'bg-indigo-50 text-indigo-500',
  NOT_SELECTED: 'bg-neutral-100 text-slate',
};

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

/**
 * US-24, US-25: upload, autosave, checklist and final submit — in the visual language of the
 * prototype's UploadSheet (CompetitionsPage.tsx): dashed drop zone, ringed inputs, teal CTA.
 */
export default function SubmissionScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const q = useSubmission(registrationId);

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return (
      <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
        <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
          <BackHeader title={t('submission.title')} onBack={() => router.back()} />
          <EmptyState
            style={tw`flex-1`}
            illustration={<NoNetworkArt />}
            title={t('common.somethingWrong')}
            message={
              q.error instanceof ApiError && q.error.requestId
                ? `${errorMessage(q.error, t)}\n${t('common.requestId', { id: q.error.requestId })}`
                : errorMessage(q.error, t)
            }
            primary={{ label: t('common.retry'), onPress: () => void q.refetch() }}
          />
        </View>
      </SafeAreaView>
    );
  }
  return <Editor initial={q.data} />;
}

function Editor({ initial }: { initial: SubmissionView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const detail = useCompetition(initial.competition.id);
  const now = useNow(30_000);

  const [s, setS] = useState(initial);
  const [caption, setCaption] = useState(initial.caption ?? '');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploading, setUploading] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (detail.data) syncServerClock(detail.data.serverTime);
  }, [detail.data]);
  useEffect(() => () => clearTimeout(captionTimer.current ?? undefined), []);

  const locked = s.status === 'SUBMITTED';
  const checklist = submissionChecklist({ mediaKey: s.mediaUrl, caption, rulesAccepted: s.rulesAccepted });
  const missing = [checklist.media, checklist.caption, checklist.rules].filter((x) => !x).length;

  // The same window the API checks: from the start time until submissions close (SRS §2.5).
  const c = detail.data;
  const startsAt = c?.submissionStartsAt ? new Date(c.submissionStartsAt).getTime() : null;
  const endsAt = c?.submissionEndsAt ? new Date(c.submissionEndsAt).getTime() : null;
  const clock = Math.max(now, serverNow());
  const notYet = startsAt !== null && clock < startsAt;
  const closed =
    c?.status !== undefined && (c.status !== 'PUBLISHED' || (endsAt !== null && clock >= endsAt));

  const refresh = (next: SubmissionView) => {
    setS(next);
    qc.setQueryData(['submission', next.registrationId], next);
    void qc.invalidateQueries({ queryKey: ['my-submissions'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
  };

  const save = async (input: SubmissionUpdateInput) => {
    setSaving('saving');
    setError(null);
    try {
      refresh(await updateSubmission(s.registrationId, input));
      setSaving('saved');
    } catch (e) {
      setSaving('idle');
      setError(errorMessage(e, t));
    }
  };

  /** FR-SB-03: the draft autosaves; typing is debounced so each keystroke isn't a request. */
  const onCaption = (v: string) => {
    setCaption(v);
    clearTimeout(captionTimer.current ?? undefined);
    captionTimer.current = setTimeout(() => void save({ caption: v.trim() || null }), CAPTION_SAVE_DELAY_MS);
  };

  const flushCaption = async () => {
    if (!captionTimer.current) return;
    clearTimeout(captionTimer.current);
    captionTimer.current = null;
    if ((s.caption ?? '') !== caption.trim()) await save({ caption: caption.trim() || null });
  };

  const upload = async (pick: () => Promise<PickedFile>) => {
    setError(null);
    try {
      const file = await pick();
      setUploading(0);
      const target = await mediaUploadUrl(s.registrationId, file.contentType, file.sizeBytes);
      await uploadToStorage(target, file, setUploading);
      await save({ mediaKey: target.key });
    } catch (e) {
      if ((e as { reason?: string }).reason !== 'cancelled') setError(errorMessage(e, t));
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await flushCaption();
      refresh(await submitEntry(s.registrationId));
      void qc.invalidateQueries({ queryKey: ['competition', s.competition.id] });
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSubmitting(false);
    }
  };

  const blockedReason = locked
    ? null
    : closed
      ? t('submission.closed')
      : notYet
        ? t('submission.opensAt', { date: formatDateTime(c?.submissionStartsAt) })
        : missing > 0
          ? t('submission.moreSteps', { count: missing })
          : null;

  const goBack = () =>
    void flushCaption().finally(() => (router.canGoBack() ? router.back() : router.replace('/submissions')));
  const percent = uploading === null ? 0 : Math.round(uploading * 100);

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader
          subtitle={t('submission.for', { title: s.competition.title })}
          title={locked ? t('submission.title') : t('design.uploadSubmission')}
          onBack={goBack}
        />
        <ScrollView
          contentContainerStyle={tw`px-4 pt-2 pb-8 gap-4`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Press
            onPress={() => router.push(`/competition/${s.competition.id}`)}
            accessibilityRole="link"
            accessibilityLabel={s.competition.title}
            style={tw`flex-row items-center gap-3 rounded-2xl bg-white p-3 shadow-sm`}
          >
            <CoverImage uri={s.competition.coverUrl} style={tw`w-12 h-12 rounded-xl`} />
            <View style={tw`flex-1 min-w-0`}>
              <T style={tw`font-extrabold text-ink text-sm`} numberOfLines={1}>
                {s.competition.title}
              </T>
              {endsAt && !locked && !closed && !notYet ? (
                <View style={tw`flex-row items-center gap-1 mt-0.5`}>
                  <Clock size={14} color={color('teal')} />
                  <T style={tw`text-[11px] font-semibold text-teal`}>
                    {t('countdown.submitIn', { time: formatDuration(endsAt - clock, t) })}
                  </T>
                </View>
              ) : (
                <T style={tw`text-xs text-slate`} numberOfLines={1}>
                  {s.submittedAt
                    ? t('mySubs.submittedAt', { when: formatWhen(s.submittedAt, t) })
                    : t('submission.viewCompetition')}
                </T>
              )}
            </View>
            <StatusPill label={t(`mySubs.filter.${s.displayStatus}`)} tint={STATUS_TINT[s.displayStatus]} />
          </Press>

          {s.result?.rank && s.result.prizePaise > 0 ? (
            <View style={tw`flex-row items-center justify-between rounded-2xl bg-amber-50 px-3.5 py-2.5`}>
              <View style={tw`flex-row items-center gap-1.5`}>
                <Trophy color={color('amber-700')} />
                <T style={tw`text-xs font-bold text-amber-700`}>
                  {t('mySubs.place', { place: ordinal(s.result.rank) })} ·{' '}
                  {t('submission.score', { score: s.result.score ?? '—' })}
                </T>
              </View>
              <T style={tw`text-sm font-extrabold text-amber-700`}>{inr(s.result.prizePaise)}</T>
            </View>
          ) : s.result?.rank ? (
            <Banner
              tone="neutral"
              icon={<Trophy color={color('slate')} />}
              text={t('submission.result', { rank: s.result.rank, score: s.result.score ?? '—' })}
            />
          ) : locked ? (
            <Banner
              tone="mint"
              icon={<Lock size={16} color={color('teal')} />}
              text={t('submission.submitted')}
            />
          ) : null}
          {error ? <Banner tone="rose" text={error} /> : null}

          {!locked ? (
            <View style={tw`rounded-2xl bg-white p-4 shadow-sm`}>
              <View style={tw`flex-row items-center justify-between`}>
                <T style={tw`text-sm font-bold text-ink`}>{t('submission.checklistTitle')}</T>
                <T style={tw`text-xs font-bold text-teal`}>{checklist.percent}%</T>
              </View>
              <View style={tw`mt-2 h-1.5 rounded-full bg-mint overflow-hidden`}>
                <View style={[tw`h-full rounded-full bg-teal`, { width: `${checklist.percent}%` }]} />
              </View>
              <View style={tw`mt-3 gap-2`}>
                <Check done={checklist.media} label={t('submission.media')} />
                <Check done={checklist.caption} label={t('submission.caption')} />
                <Check done={checklist.rules} label={t('submission.rules')} />
              </View>
            </View>
          ) : null}

          <MediaPreview url={s.mediaUrl} kind={s.mediaType} />

          {!locked ? (
            <View
              style={[
                tw`items-center justify-center gap-2 rounded-2xl border-2 py-8 px-4`,
                {
                  borderStyle: 'dashed',
                  borderColor: 'rgba(13,128,116,0.4)',
                  backgroundColor: 'rgba(232,245,241,0.4)',
                },
              ]}
            >
              <View style={tw`w-11 h-11 rounded-full bg-teal items-center justify-center`}>
                <Upload color="#fff" />
              </View>
              {uploading !== null ? (
                <View style={tw`w-full items-center gap-2`} accessibilityLiveRegion="polite">
                  <T style={tw`text-sm font-semibold text-ink`}>{t('submission.uploading', { percent })}</T>
                  <View style={tw`w-48 h-1.5 rounded-full bg-white overflow-hidden`}>
                    <View style={[tw`h-full rounded-full bg-teal`, { width: `${percent}%` }]} />
                  </View>
                </View>
              ) : (
                <>
                  <T style={tw`text-sm font-semibold text-ink`}>
                    {s.mediaUrl ? t('submission.replace') : t('submission.chooseFile')}
                  </T>
                  <T style={tw`text-[11px] text-slate text-center`}>{t('submission.mediaHint')}</T>
                  <View style={tw`mt-1 flex-row gap-2`}>
                    <KindButton
                      icon={<Camera color={color('teal')} />}
                      label={t('submission.addImage')}
                      onPress={() => void upload(() => pickImage())}
                    />
                    <KindButton
                      icon={<Play size={16} color={color('teal')} />}
                      label={t('submission.addVideo')}
                      onPress={() => void upload(pickVideo)}
                    />
                    <KindButton
                      icon={<Chat size={16} color={color('teal')} />}
                      label={t('submission.addAudio')}
                      onPress={() => void upload(pickAudio)}
                    />
                  </View>
                </>
              )}
            </View>
          ) : null}

          {locked ? (
            caption ? (
              <View style={tw`rounded-2xl bg-white p-4 shadow-sm`}>
                <T style={tw`text-xs font-semibold text-slate mb-1`}>{t('submission.captionLabel')}</T>
                <T style={tw`text-sm text-ink leading-relaxed`}>{caption}</T>
              </View>
            ) : null
          ) : (
            <View>
              <View style={tw`flex-row items-center justify-between mb-1.5`}>
                <T style={tw`text-xs font-semibold text-slate`}>{t('submission.captionLabel')}</T>
                <T style={tw`text-[11px] text-slate`}>
                  {caption.trim().length}/{defaultRules.text.captionMax}
                </T>
              </View>
              <TextInput
                value={caption}
                onChangeText={onCaption}
                onBlur={() => void flushCaption()}
                placeholder={t('submission.captionPlaceholder')}
                placeholderTextColor={color('slate')}
                accessibilityLabel={t('submission.captionLabel')}
                multiline
                maxLength={defaultRules.text.captionMax}
                textAlignVertical="top"
                style={[
                  tw`min-h-24 rounded-xl bg-white px-3.5 py-3 text-sm text-ink`,
                  ring(1, color('neutral-200')),
                  { fontFamily: 'Poppins_400Regular' },
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                ]}
              />
            </View>
          )}

          {!locked ? (
            <View
              style={[
                tw`flex-row items-center gap-3 rounded-xl bg-white px-3.5 py-3`,
                ring(1, color('neutral-200')),
              ]}
            >
              <Shield size={18} color={color('teal')} />
              <T style={tw`flex-1 text-sm text-ink`}>{t('submission.rules')}</T>
              <Switch
                value={s.rulesAccepted}
                onValueChange={(v) => void save({ rulesAccepted: v })}
                trackColor={{ true: color('teal'), false: color('neutral-200') }}
                thumbColor="#fff"
                {...({ activeThumbColor: '#fff' } as object)}
                accessibilityLabel={t('submission.rules')}
              />
            </View>
          ) : null}

          {!locked ? (
            <T style={tw`text-[11px] text-slate text-center`}>
              {saving === 'saving'
                ? t('common.saving')
                : saving === 'saved'
                  ? t('common.saved')
                  : t('submission.autosave')}
            </T>
          ) : null}
        </ScrollView>

        {!locked ? (
          <View style={[tw`px-4 pt-3 pb-4 border-t bg-canvas`, { borderColor: 'rgba(229,229,229,0.7)' }]}>
            {blockedReason ? (
              <T style={tw`mb-2 text-[11px] text-slate text-center`} accessibilityLiveRegion="polite">
                {blockedReason}
              </T>
            ) : null}
            <SheetButton
              title={t('submission.submit')}
              onPress={() => void submit()}
              loading={submitting}
              disabled={!!blockedReason || uploading !== null || !c}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- bits

function KindButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      scale={0.97}
      style={[
        tw`flex-row items-center gap-1.5 rounded-full bg-white px-3.5 py-2`,
        ring(1, 'rgba(13,128,116,0.2)'),
      ]}
    >
      {icon}
      <T style={tw`text-xs font-semibold text-teal`}>{label}</T>
    </Press>
  );
}

const BANNER = {
  mint: { bg: 'bg-mint', fg: 'text-teal' },
  rose: { bg: 'bg-rose-50', fg: 'text-rose-500' },
  neutral: { bg: 'bg-neutral-100', fg: 'text-slate' },
} as const;

function Banner({ tone, icon, text }: { tone: keyof typeof BANNER; icon?: ReactNode; text: string }) {
  return (
    <View
      style={tw`flex-row items-center gap-2 rounded-2xl px-3.5 py-2.5 ${BANNER[tone].bg}`}
      accessibilityLiveRegion="polite"
    >
      {icon}
      <T style={tw`flex-1 text-xs font-semibold ${BANNER[tone].fg}`}>{text}</T>
    </View>
  );
}

const Check = ({ done, label }: { done: boolean; label: string }) => (
  <View
    style={tw`flex-row items-center gap-2`}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: done }}
    accessibilityLabel={label}
  >
    <CheckCircle size={18} color={done ? color('teal') : color('neutral-300')} />
    <T style={tw`text-sm ${done ? 'text-ink font-semibold' : 'text-slate'}`}>{label}</T>
  </View>
);

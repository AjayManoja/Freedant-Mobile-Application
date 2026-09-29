import { Ionicons } from '@expo/vector-icons';
import {
  defaultRules,
  type SubmissionUpdateInput,
  type SubmissionView,
  submissionChecklist,
} from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ApiError } from '@/api/client';
import { mediaUploadUrl, submitEntry, updateSubmission, useCompetition, useSubmission } from '@/api/hooks';
import { serverNow, SubmissionBadge, syncServerClock, useNow } from '@/components/competition';
import { MediaPreview } from '@/components/media';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  Field,
  Header,
  Loading,
  Notice,
  ProgressBar,
  Row,
  Screen,
} from '@/components/ui';
import { errorMessage, formatDateTime, formatDuration, formatInr } from '@/lib/format';
import { type PickedFile, pickAudio, pickImage, pickVideo, uploadToStorage } from '@/media/media';
import { colors, radius, space } from '@/theme/tokens';

const CAPTION_SAVE_DELAY_MS = 800;

/** US-24, US-25: upload, autosave, checklist and final submit. */
export default function SubmissionScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const q = useSubmission(registrationId);

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return (
      <Screen>
        <Header title={t('submission.title')} onBack={() => router.back()} />
        <ErrorState
          message={errorMessage(q.error, t)}
          requestId={q.error instanceof ApiError ? q.error.requestId : undefined}
          onRetry={() => void q.refetch()}
        />
      </Screen>
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

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        locked ? null : (
          <>
            {blockedReason ? (
              <AppText variant="caption" accessibilityLiveRegion="polite">
                {blockedReason}
              </AppText>
            ) : null}
            <Button
              title={t('submission.submit')}
              icon="send-outline"
              onPress={() => void submit()}
              loading={submitting}
              disabled={!!blockedReason || uploading !== null || !c}
            />
          </>
        )
      }
    >
      <Header title={t('submission.title')} onBack={() => void flushCaption().finally(() => router.back())} />

      <Pressable
        onPress={() => router.push(`/competition/${s.competition.id}`)}
        accessibilityRole="link"
        style={styles.compLink}
      >
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={2}>
            {s.competition.title}
          </AppText>
          {endsAt && !locked ? (
            <AppText variant="caption">
              {t('countdown.submitIn', { time: formatDuration(endsAt - clock, t) })}
            </AppText>
          ) : null}
        </View>
        <SubmissionBadge status={s.displayStatus} />
      </Pressable>

      {locked ? <Notice tone="success" icon="lock-closed-outline" text={t('submission.submitted')} /> : null}
      {s.result?.rank ? (
        <Card>
          <AppText variant="heading">
            {t('submission.result', { rank: s.result.rank, score: s.result.score ?? '—' })}
          </AppText>
          {s.result.prizePaise > 0 ? (
            <AppText variant="bodyStrong" color={colors.success}>
              {t('submission.prize', { amount: formatInr(s.result.prizePaise) })}
            </AppText>
          ) : null}
        </Card>
      ) : null}
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      {!locked ? (
        <Card>
          <AppText variant="label">{t('submission.checklist', { percent: checklist.percent })}</AppText>
          <ProgressBar value={checklist.percent / 100} />
          <Check done={checklist.media} label={t('submission.media')} />
          <Check done={checklist.caption} label={t('submission.caption')} />
          <Check done={checklist.rules} label={t('submission.rules')} />
        </Card>
      ) : null}

      <MediaPreview url={s.mediaUrl} kind={s.mediaType} />
      {uploading !== null ? (
        <View style={styles.gap} accessibilityLiveRegion="polite">
          <AppText variant="caption">
            {t('submission.uploading', { percent: Math.round(uploading * 100) })}
          </AppText>
          <ProgressBar value={uploading} />
        </View>
      ) : null}
      {!locked ? (
        <>
          <AppText variant="caption">
            {s.mediaUrl ? t('submission.replace') : t('submission.mediaHint')}
          </AppText>
          <Row>
            <MediaButton
              icon="image-outline"
              label={t('submission.addImage')}
              disabled={uploading !== null}
              onPress={() => void upload(() => pickImage())}
            />
            <MediaButton
              icon="videocam-outline"
              label={t('submission.addVideo')}
              disabled={uploading !== null}
              onPress={() => void upload(pickVideo)}
            />
            <MediaButton
              icon="musical-notes-outline"
              label={t('submission.addAudio')}
              disabled={uploading !== null}
              onPress={() => void upload(pickAudio)}
            />
          </Row>
        </>
      ) : null}

      {locked ? (
        caption ? (
          <Card>
            <AppText variant="body">{caption}</AppText>
          </Card>
        ) : null
      ) : (
        <Field
          label={t('submission.caption')}
          placeholder={t('submission.captionPlaceholder')}
          value={caption}
          onChangeText={onCaption}
          onBlur={() => void flushCaption()}
          multiline
          maxLength={defaultRules.text.captionMax}
          hint={`${caption.trim().length}/${defaultRules.text.captionMax}`}
        />
      )}

      {!locked ? (
        <Row style={styles.between}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {t('submission.rules')}
          </AppText>
          <Switch
            value={s.rulesAccepted}
            onValueChange={(v) => void save({ rulesAccepted: v })}
            trackColor={{ true: colors.teal, false: colors.border }}
            accessibilityLabel={t('submission.rules')}
          />
        </Row>
      ) : null}

      {!locked ? (
        <AppText variant="caption">
          {saving === 'saving'
            ? t('common.saving')
            : saving === 'saved'
              ? t('common.saved')
              : t('submission.autosave')}
        </AppText>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------- bits

function MediaButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'image-outline' | 'videocam-outline' | 'musical-notes-outline';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.mediaButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.teal} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const Check = ({ done, label }: { done: boolean; label: string }) => (
  <View
    style={styles.check}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: done }}
    accessibilityLabel={label}
  >
    <Ionicons
      name={done ? 'checkmark-circle' : 'ellipse-outline'}
      size={20}
      color={done ? colors.success : colors.slate}
    />
    <AppText variant={done ? 'bodyStrong' : 'body'}>{label}</AppText>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.xs },
  between: { justifyContent: 'space-between' },
  compLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mediaButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

import { Ionicons } from '@expo/vector-icons';
import {
  type CompetitionDetail,
  computePrizeTiers,
  defaultRules,
  deriveTimeline,
  type DraftFields,
  draftIssues,
  type DraftUpdateInput,
  draftUpdateSchema,
  type WizardStep,
} from '@feedants/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, newIdempotencyKey } from '@/api/client';
import {
  abandonFunding,
  coverUploadUrl,
  publish,
  saveDraft,
  useCategories,
  useCompetition,
} from '@/api/hooks';
import { useSession } from '@/auth/session';
import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Header,
  Loading,
  Notice,
  ProgressBar,
  Row,
  Screen,
} from '@/components/ui';
import { pickImage, uploadToStorage } from '@/media/media';
import { errorMessage, formatDateTime, formatInr } from '@/lib/format';
import { isFakeCheckout, openRazorpayCheckout, simulateFakePayment } from '@/payments/checkout';
import { colors, radius, space } from '@/theme/tokens';

type Step = WizardStep | 'REVIEW';
const STEPS: Step[] = ['BASICS', 'PRIZE', 'SCHEDULE', 'REVIEW'];
const rules = defaultRules;

interface Form {
  title: string;
  categoryId: number | null;
  description: string;
  coverKey: string | null;
  coverUrl: string | null;
  prizePoolPaise: number | null;
  entryFeeRupees: string;
  date: string; // YYYY-MM-DD, local time
  time: string; // HH:MM, local time
  durationDays: number | null;
  maxSpots: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
function defaultStart(): { date: string; time: string } {
  const d = new Date(Date.now() + 24 * 3_600_000);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: '18:00' };
}
function startIso(f: Form): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(f.time);
  if (!m || !tm) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(tm[1]), Number(tm[2]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fromDetail(c: CompetitionDetail): Form {
  const start = c.startAt ? new Date(c.startAt) : null;
  const fallback = defaultStart();
  return {
    title: c.title === 'Untitled competition' ? '' : c.title,
    categoryId: c.category?.id ?? null,
    description: c.description ?? '',
    coverKey: null,
    coverUrl: c.coverUrl,
    prizePoolPaise: c.prizePoolPaise || null,
    entryFeeRupees: c.entryFeePaise ? String(c.entryFeePaise / 100) : '0',
    date: start
      ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
      : fallback.date,
    time: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : fallback.time,
    durationDays: c.durationDays,
    maxSpots: c.maxSpots ? String(c.maxSpots) : '',
  };
}

/** FR-HS-01..07 / US-14, US-15. */
export default function HostWizard() {
  const { id: resumeId } = useLocalSearchParams<{ id?: string }>();
  const existing = useCompetition(resumeId);
  const { t } = useTranslation();
  if (resumeId && existing.isPending) return <Loading />;
  if (resumeId && existing.isError)
    return <ErrorState message={errorMessage(existing.error, t)} onRetry={() => void existing.refetch()} />;
  return <Wizard initial={existing.data ?? null} />;
}

function Wizard({ initial }: { initial: CompetitionDetail | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const categories = useCategories();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [step, setStep] = useState<Step>('BASICS');
  const [form, setForm] = useState<Form>(() =>
    initial
      ? fromDetail(initial)
      : {
          title: '',
          categoryId: null,
          description: '',
          coverKey: null,
          coverUrl: null,
          prizePoolPaise: rules.prizePool.presetsPaise[1] ?? null,
          entryFeeRupees: '0',
          ...defaultStart(),
          durationDays: 7,
          maxSpots: '100',
        },
  );
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploading, setUploading] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [awaiting, setAwaiting] = useState(initial?.status === 'AWAITING_FUNDING');
  const publishKey = useRef(newIdempotencyKey());
  // US-16: a published competition with no registrations yet is edited, not re-funded.
  const editingLive = initial?.status === 'PUBLISHED';

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const entryFeePaise = /^\d+$/.test(form.entryFeeRupees) ? Number(form.entryFeeRupees) * 100 : null;
  const draft: DraftFields = {
    title: form.title.trim() || null,
    categoryId: form.categoryId,
    prizePoolPaise: form.prizePoolPaise,
    entryFeePaise,
    startAt: startIso(form),
    durationDays: form.durationDays,
    maxSpots: /^\d+$/.test(form.maxSpots) ? Number(form.maxSpots) : null,
  };

  // Exactly the rules the API enforces, so Continue is enabled only when the server will agree.
  const issues = (() => {
    const all = draftIssues(draft, new Date(), rules);
    const field = (k: keyof DraftUpdateInput, v: unknown) =>
      v === null ? true : draftUpdateSchema.safeParse({ [k]: v }).success;
    return all
      .filter((i) => i.field !== 'title' || !field('title', draft.title))
      .concat(
        draft.maxSpots !== null && !field('maxSpots', draft.maxSpots)
          ? [{ step: 'SCHEDULE', field: 'maxSpots', message: '' } as const]
          : [],
        entryFeePaise !== null && !field('entryFeePaise', entryFeePaise)
          ? [{ step: 'PRIZE', field: 'entryFeePaise', message: '' } as const]
          : [],
      );
  })();
  const stepIssues = (s: Step) => (s === 'REVIEW' ? issues : issues.filter((i) => i.step === s));
  const issueFor = (field: keyof DraftFields) => {
    const i = issues.find((x) => x.field === field);
    return i ? i.message || t('errors.VALIDATION_FAILED') : null;
  };

  const tiers =
    form.prizePoolPaise && form.prizePoolPaise >= rules.prizePool.minPaise
      ? computePrizeTiers(form.prizePoolPaise)
      : [];
  const timeline =
    draft.startAt && draft.durationDays ? deriveTimeline(new Date(draft.startAt), draft.durationDays) : null;

  /** FR-HS-05: every step change autosaves the draft. */
  const persist = async (): Promise<string | null> => {
    const payload: DraftUpdateInput = {};
    if (draft.title && draftUpdateSchema.safeParse({ title: draft.title }).success)
      payload.title = draft.title;
    if (draft.categoryId !== null) payload.categoryId = draft.categoryId;
    payload.description = form.description.trim() || null;
    if (form.coverKey) payload.coverKey = form.coverKey;
    for (const [k, v] of [
      ['prizePoolPaise', draft.prizePoolPaise],
      ['entryFeePaise', draft.entryFeePaise],
      ['startAt', draft.startAt],
      ['durationDays', draft.durationDays],
      ['maxSpots', draft.maxSpots],
    ] as const) {
      if (v !== null && draftUpdateSchema.safeParse({ [k]: v }).success)
        (payload as Record<string, unknown>)[k] = v;
    }
    setSaving('saving');
    try {
      const saved = await saveDraft(id, payload);
      setId(saved.id);
      setForm((f) => ({ ...f, coverKey: null, coverUrl: saved.coverUrl }));
      setSaving('saved');
      void qc.invalidateQueries({ queryKey: ['hosted'] });
      return saved.id;
    } catch (e) {
      setSaving('idle');
      setError(errorMessage(e, t));
      return null;
    }
  };

  const go = async (next: Step) => {
    setError(null);
    // The server locks details while a funding payment is pending.
    if (awaiting || (await persist())) setStep(next);
  };

  const saveLive = async () => {
    setError(null);
    if (await persist()) {
      void qc.invalidateQueries({ queryKey: ['competition', id] });
      router.back();
    }
  };

  const addCover = async () => {
    setError(null);
    try {
      const competitionId = id ?? (await persist());
      if (!competitionId) return;
      const file = await pickImage(rules.media.IMAGE.maxBytes);
      setUploading(0);
      const target = await coverUploadUrl(competitionId, file.contentType, file.sizeBytes);
      await uploadToStorage(target, file, setUploading);
      set({ coverKey: target.key, coverUrl: file.uri });
    } catch (e) {
      if ((e as { reason?: string }).reason !== 'cancelled') setError(errorMessage(e, t));
    } finally {
      setUploading(null);
    }
  };

  /** US-15: publishing = funding the prize pool; it goes live when Payment confirms. */
  const fundAndPublish = async () => {
    setError(null);
    setPublishing(true);
    try {
      const competitionId = awaiting ? id : await persist();
      if (!competitionId) return;
      const res = await publish(competitionId, publishKey.current);
      setAwaiting(true);
      if (isFakeCheckout(res.checkout)) await simulateFakePayment(res.checkout, 'captured');
      else {
        const outcome = await openRazorpayCheckout(
          res.checkout,
          { email: user?.email, name: user?.displayName ?? undefined },
          form.title,
        );
        if (outcome !== 'submitted') return;
      }
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const c = await qc.fetchQuery({
          queryKey: ['competition', competitionId, 'poll', i],
          queryFn: () => peek(competitionId),
        });
        // US-15: an abandoned or failed payment returns the competition to Draft, uncharged.
        if (c.status === 'DRAFT') {
          setAwaiting(false);
          publishKey.current = newIdempotencyKey();
          setError(t('join.failed'));
          return;
        }
        if (c.status === 'PUBLISHED') {
          setLive(true);
          void qc.invalidateQueries({ queryKey: ['hosted'] });
          void qc.invalidateQueries({ queryKey: ['home'] });
          return;
        }
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setPublishing(false);
    }
  };

  /** Gives up on a pending payment so the draft can be edited again. */
  const backToDraft = async () => {
    if (!id) return;
    setError(null);
    try {
      await abandonFunding(id);
      publishKey.current = newIdempotencyKey();
      setAwaiting(false);
      void qc.invalidateQueries({ queryKey: ['hosted'] });
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  if (live && id) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.liveBlock}>
          <View style={styles.liveIcon}>
            <Ionicons name="rocket-outline" size={40} color={colors.white} />
          </View>
          <AppText variant="display">{t('host.live')}</AppText>
          <AppText variant="body">{t('host.liveBody', { title: form.title })}</AppText>
          <Card style={styles.full}>
            <Summary label={t('host.prizePool')} value={formatInr(form.prizePoolPaise ?? 0)} />
            <Summary label={t('host.maxSpots')} value={form.maxSpots} />
            <Summary label={t('host.duration')} value={t('host.days', { count: form.durationDays ?? 0 })} />
          </Card>
          <Button
            title={t('host.goDashboard')}
            style={styles.full}
            onPress={() => router.replace('/competitions')}
          />
          <Button
            title={t('host.hostAnother')}
            kind="ghost"
            style={styles.full}
            onPress={() => router.replace('/host')}
          />
        </View>
      </Screen>
    );
  }

  const index = STEPS.indexOf(step);
  const blocked = stepIssues(step).length > 0;

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        step === 'REVIEW' && editingLive ? (
          <Button
            title={t('common.save')}
            onPress={() => void saveLive()}
            loading={saving === 'saving'}
            disabled={blocked}
          />
        ) : step === 'REVIEW' ? (
          <>
            <AppText variant="caption">{t('host.fundingNote')}</AppText>
            <Button
              title={t('host.publish', { amount: formatInr(form.prizePoolPaise ?? 0) })}
              onPress={() => void fundAndPublish()}
              loading={publishing}
              disabled={blocked}
            />
          </>
        ) : (
          <Button
            title={t('common.continue')}
            onPress={() => void go(STEPS[index + 1]!)}
            disabled={blocked}
            loading={saving === 'saving'}
          />
        )
      }
    >
      <Header
        title={t('host.title')}
        onBack={() => (index === 0 ? router.back() : setStep(STEPS[index - 1]!))}
      />

      <View
        style={styles.stepper}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 4, now: index + 1 }}
      >
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= index && styles.stepDotActive]}>
              <AppText variant="label" color={i <= index ? colors.white : colors.slateStrong}>
                {i + 1}
              </AppText>
            </View>
            <AppText variant="label" color={i === index ? colors.teal : colors.slateStrong}>
              {t(`host.steps.${s}`)}
            </AppText>
          </View>
        ))}
      </View>
      {saving === 'saved' ? <AppText variant="caption">{t('host.savedDraft')}</AppText> : null}
      {awaiting && !publishing ? (
        <>
          <Notice tone="warning" icon="hourglass-outline" text={t('host.awaitingFunding')} />
          <Button title={t('host.abandon')} kind="ghost" onPress={() => void backToDraft()} />
        </>
      ) : null}
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      {step === 'BASICS' ? (
        <>
          <Field
            label={t('host.titleLabel')}
            hint={t('host.titleHint')}
            value={form.title}
            onChangeText={(v) => set({ title: v })}
            maxLength={rules.text.titleMax}
            error={form.title && issueFor('title')}
          />
          <AppText variant="label">{t('host.category')}</AppText>
          <Row style={styles.wrap}>
            {(categories.data ?? []).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={form.categoryId === c.id}
                onPress={() => set({ categoryId: c.id })}
              />
            ))}
          </Row>
          <Field
            label={t('host.description')}
            value={form.description}
            onChangeText={(v) => set({ description: v })}
            multiline
            maxLength={rules.text.descriptionMax}
          />
          <AppText variant="label">{t('host.cover')}</AppText>
          <Pressable
            onPress={() => void addCover()}
            accessibilityRole="button"
            accessibilityLabel={form.coverUrl ? t('host.changeCover') : t('host.addCover')}
            style={styles.coverBox}
          >
            {form.coverUrl ? (
              <Image source={{ uri: form.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            <Row>
              <Ionicons name="image-outline" size={20} color={colors.teal} />
              <AppText variant="bodyStrong" color={colors.teal}>
                {form.coverUrl ? t('host.changeCover') : t('host.addCover')}
              </AppText>
            </Row>
          </Pressable>
          {uploading !== null ? <ProgressBar value={uploading} /> : null}
        </>
      ) : null}

      {step === 'PRIZE' ? (
        <>
          <AppText variant="label">{t('host.prizePool')}</AppText>
          <AppText variant="caption">{t('host.prizeHint')}</AppText>
          <Row style={styles.wrap}>
            {rules.prizePool.presetsPaise.map((p) => (
              <Chip
                key={p}
                label={formatInr(p)}
                selected={form.prizePoolPaise === p}
                onPress={() => {
                  setCustom('');
                  set({ prizePoolPaise: p });
                }}
              />
            ))}
          </Row>
          <Field
            label={t('host.custom')}
            keyboardType="number-pad"
            value={custom}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '');
              setCustom(digits);
              set({ prizePoolPaise: digits ? Number(digits) * 100 : null });
            }}
            error={
              issueFor('prizePoolPaise') && form.prizePoolPaise !== null
                ? t('errors.VALIDATION_FAILED')
                : null
            }
            hint={`${formatInr(rules.prizePool.minPaise)} – ${formatInr(rules.prizePool.maxPaise)}`}
          />
          <Field
            label={t('host.entryFee')}
            keyboardType="number-pad"
            value={form.entryFeeRupees}
            onChangeText={(v) => set({ entryFeeRupees: v.replace(/\D/g, '') })}
            error={issueFor('entryFeePaise')}
            hint={`0 · ${formatInr(rules.entryFee.minPaise)} – ${formatInr(rules.entryFee.maxPaise)}`}
          />
          {tiers.length > 0 ? (
            <Card>
              <AppText variant="label">{t('host.tiers')}</AppText>
              {tiers.map((tier) => (
                <Summary
                  key={tier.rank}
                  label={t('detail.rank', { rank: tier.rank })}
                  value={formatInr(tier.amountPaise)}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {step === 'SCHEDULE' ? (
        <>
          <Row>
            <View style={styles.flex}>
              <Field
                label={t('host.startDate')}
                value={form.date}
                onChangeText={(v) => set({ date: v })}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.flex}>
              <Field
                label={t('host.startTime')}
                value={form.time}
                onChangeText={(v) => set({ time: v })}
                placeholder="18:00"
              />
            </View>
          </Row>
          {issueFor('startAt') ? (
            <AppText variant="caption" color={colors.danger}>
              {issueFor('startAt')}
            </AppText>
          ) : null}
          <AppText variant="label">{t('host.duration')}</AppText>
          <Row style={styles.wrap}>
            {rules.schedule.durationsDays.map((d) => (
              <Chip
                key={d}
                label={t('host.days', { count: d })}
                selected={form.durationDays === d}
                onPress={() => set({ durationDays: d })}
              />
            ))}
          </Row>
          <Field
            label={t('host.maxSpots')}
            keyboardType="number-pad"
            value={form.maxSpots}
            onChangeText={(v) => set({ maxSpots: v.replace(/\D/g, '') })}
            error={form.maxSpots ? issueFor('maxSpots') : null}
            hint={`${rules.spots.min} – ${rules.spots.max}`}
          />
          {timeline ? <Timeline timeline={timeline} /> : null}
        </>
      ) : null}

      {step === 'REVIEW' ? (
        <>
          <Card>
            <AppText variant="heading">{form.title}</AppText>
            <Summary
              label={t('host.category')}
              value={categories.data?.find((c) => c.id === form.categoryId)?.name ?? '—'}
            />
            <Summary label={t('host.prizePool')} value={formatInr(form.prizePoolPaise ?? 0)} />
            <Summary
              label={t('detail.entryFee')}
              value={entryFeePaise ? formatInr(entryFeePaise) : t('common.free')}
            />
            <Summary label={t('host.maxSpots')} value={form.maxSpots} />
            <Summary label={t('host.duration')} value={t('host.days', { count: form.durationDays ?? 0 })} />
          </Card>
          {tiers.length > 0 ? (
            <Card>
              <AppText variant="label">{t('host.tiers')}</AppText>
              {tiers.map((tier) => (
                <Summary
                  key={tier.rank}
                  label={t('detail.rank', { rank: tier.rank })}
                  value={formatInr(tier.amountPaise)}
                />
              ))}
            </Card>
          ) : null}
          {timeline ? <Timeline timeline={timeline} /> : null}
          {issues.map((i) => (
            <Notice
              key={i.field}
              tone="warning"
              icon="alert-circle-outline"
              text={`${t(`host.steps.${i.step}`)}: ${i.message || t('errors.VALIDATION_FAILED')}`}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

/** Reads a competition fresh (no cache) while waiting for funding to land. */
const peek = (id: string) => api<CompetitionDetail>(`/v1/competitions/${id}`);

function Timeline({ timeline }: { timeline: ReturnType<typeof deriveTimeline> }) {
  const { t } = useTranslation();
  return (
    <Card>
      <AppText variant="label">{t('host.timeline')}</AppText>
      <Summary
        label={t('detail.registrationOpens')}
        value={formatDateTime(timeline.registrationOpensAt.toISOString())}
      />
      <Summary
        label={t('detail.registrationCloses')}
        value={formatDateTime(timeline.registrationClosesAt.toISOString())}
      />
      <Summary
        label={t('detail.submissionsClose')}
        value={formatDateTime(timeline.submissionEndsAt.toISOString())}
      />
      <Summary label={t('detail.resultsDue')} value={formatDateTime(timeline.resultsDueAt.toISOString())} />
    </Card>
  );
}

const Summary = ({ label, value }: { label: string; value: string }) => (
  <Row style={styles.between}>
    <AppText variant="caption">{label}</AppText>
    <AppText variant="bodyStrong">{value}</AppText>
  </Row>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { alignSelf: 'stretch' },
  wrap: { flexWrap: 'wrap' },
  between: { justifyContent: 'space-between', minHeight: 30 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.teal },
  coverBox: {
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  liveBlock: { alignItems: 'center', gap: space.md, paddingTop: space.xxl },
  liveIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

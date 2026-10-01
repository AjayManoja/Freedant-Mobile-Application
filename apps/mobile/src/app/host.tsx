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
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { Loading } from '@/design/loading';
import { Card, FormField, inr, Input, Press } from '@/design/components';
import { EmptyState, NoNetworkArt } from '@/design/empty';
import { Gradient } from '@/design/gradient';
import { ArrowLeft, Calendar, CheckCircle, Chevron, Megaphone, Trophy, Upload, Users } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage, formatDateTime } from '@/lib/format';
import { pickImage, uploadToStorage } from '@/media/media';
import { isFakeCheckout, openRazorpayCheckout, simulateFakePayment } from '@/payments/checkout';

type Step = WizardStep | 'REVIEW';
const STEPS: Step[] = ['BASICS', 'PRIZE', 'SCHEDULE', 'REVIEW'];
const rules = defaultRules;

/** HostPage CATEGORIES: the designed emoji per category. */
const EMOJI: Record<string, string> = {
  dance: '💃',
  music: '🎤',
  photography: '📷',
  writing: '✍️',
  art: '🎨',
  coding: '💻',
  cooking: '🍳',
  gaming: '🎮',
};
const emojiFor = (slug: string | undefined) => (slug && EMOJI[slug]) || '🏆';

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

/** Rupee amounts typed as digits and shown the design's way: "₹ 5,000". */
const rupeeText = (rupees: string) => (rupees === '' ? '' : `₹ ${Number(rupees).toLocaleString('en-IN')}`);
const digits = (v: string) => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/** FR-HS-01..07 / US-14, US-15 — design/prototype/src/pages/HostPage.tsx. */
export default function HostWizard() {
  const { id: resumeId, step } = useLocalSearchParams<{ id?: string; step?: string }>();
  const existing = useCompetition(resumeId);
  const { t } = useTranslation();
  const router = useRouter();
  if (resumeId && existing.isPending) return <Loading />;
  if (resumeId && existing.isError)
    return (
      <SafeAreaView style={tw`flex-1 bg-canvas`}>
        <EmptyState
          style={tw`flex-1`}
          illustration={<NoNetworkArt />}
          title={t('common.somethingWrong')}
          message={errorMessage(existing.error, t)}
          primary={{ label: t('common.retry'), onPress: () => void existing.refetch() }}
          secondary={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  // "Publish" on the host dashboard resumes a draft at Review.
  const startStep = resumeId && STEPS.includes(step as Step) ? (step as Step) : 'BASICS';
  return <Wizard initial={existing.data ?? null} startStep={startStep} />;
}

function Wizard({ initial, startStep }: { initial: CompetitionDetail | null; startStep: Step }) {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const categories = useCategories();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [step, setStep] = useState<Step>(startStep);
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
  const category = categories.data?.find((c) => c.id === form.categoryId);
  const durationLabel = (d: number | null) =>
    d === 7
      ? t('host.week')
      : d === 14
        ? t('host.weeks')
        : d === 30
          ? t('host.month')
          : t('host.days', { count: d ?? 0 });

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
      <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
        <View style={tw`flex-1 w-full max-w-[430px] self-center items-center justify-center px-8 gap-4`}>
          <Gradient
            dir="br"
            colors={[color('teal'), color('teal-dark')]}
            style={tw`w-20 h-20 rounded-3xl items-center justify-center shadow-lg`}
          >
            <CheckCircle size={32} color="#fff" />
          </Gradient>
          <View style={tw`items-center`}>
            <T style={tw`text-2xl font-extrabold text-ink`} accessibilityRole="header">
              {t('host.live')}
            </T>
            <T style={tw`text-sm text-slate mt-1.5 leading-relaxed max-w-[280px] text-center`}>
              <T style={tw`font-semibold text-ink`}>{form.title}</T> {t('host.liveBody')}
            </T>
          </View>
          <Card style={tw`w-full p-4 mt-2 flex-row items-center justify-around`}>
            <LiveStat value={inr(form.prizePoolPaise ?? 0)} label={t('host.prizePool')} accent />
            <LiveStat value={form.maxSpots} label={t('host.spots')} divider />
            <LiveStat value={durationLabel(form.durationDays)} label={t('host.runsFor')} divider />
          </Card>
          <View style={tw`w-full gap-2.5 mt-2`}>
            <Press
              onPress={() => router.replace('/my-competitions')}
              style={tw`w-full rounded-xl bg-teal py-3.5 items-center shadow-sm`}
            >
              <T style={tw`text-sm font-bold text-white`}>{t('host.goDashboard')}</T>
            </Press>
            <Press
              onPress={() => router.replace('/host')}
              style={[tw`w-full rounded-xl bg-white py-3.5 items-center`, ring(1, color('neutral-200'))]}
            >
              <T style={tw`text-sm font-semibold text-ink`}>{t('host.hostAnother')}</T>
            </Press>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const index = STEPS.indexOf(step);
  const blocked = stepIssues(step).length > 0;
  const busy = saving === 'saving' || publishing;

  const cta =
    step === 'REVIEW' && editingLive
      ? { title: t('common.save'), onPress: () => void saveLive() }
      : step === 'REVIEW'
        ? {
            title: t('host.publish', { amount: inr(form.prizePoolPaise ?? 0) }),
            onPress: () => void fundAndPublish(),
          }
        : { title: t('common.continue'), onPress: () => void go(STEPS[index + 1]!) };

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        {/* Header */}
        <View style={tw`flex-row items-center gap-2 px-5 pt-4 pb-2`}>
          <Press
            onPress={() => (index === 0 ? router.back() : setStep(STEPS[index - 1]!))}
            accessibilityLabel={t('common.back')}
            scale={0.95}
            style={tw`w-9 h-9 -ml-1 rounded-full items-center justify-center`}
          >
            <ArrowLeft color={color('ink')} />
          </Press>
          <View style={tw`flex-1 flex-row items-center gap-2`}>
            <View style={tw`w-8 h-8 rounded-xl bg-mint items-center justify-center`}>
              <Megaphone size={20} color={color('teal')} />
            </View>
            <T style={tw`font-extrabold text-ink text-lg leading-tight`} accessibilityRole="header">
              {t('host.title')}
            </T>
          </View>
          {saving !== 'idle' ? (
            <T style={tw`text-[11px] text-slate`} accessibilityLiveRegion="polite">
              {saving === 'saving' ? t('common.saving') : t('host.savedDraft')}
            </T>
          ) : null}
        </View>

        {/* Stepper */}
        <View
          style={tw`px-5 pt-2 pb-3 flex-row gap-1.5`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
        >
          {STEPS.map((s, i) => (
            <View key={s} style={tw`flex-1`}>
              <View style={tw`h-1.5 rounded-full ${i <= index ? 'bg-teal' : 'bg-neutral-200'}`} />
              <T style={tw`mt-1.5 text-[10px] font-semibold ${i <= index ? 'text-teal' : 'text-slate'}`}>
                {t(`host.steps.${s}`)}
              </T>
            </View>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={tw`px-4 pt-1 pb-6 gap-4`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {awaiting && !publishing ? (
            <View style={tw`rounded-2xl bg-amber-50 px-3.5 py-3 flex-row items-center gap-3`}>
              <T style={tw`flex-1 text-xs font-semibold text-amber-700`}>{t('host.awaitingFunding')}</T>
              <Pressable onPress={() => void backToDraft()} accessibilityRole="button" hitSlop={8}>
                <T style={tw`text-xs font-bold text-teal`}>{t('host.abandon')}</T>
              </Pressable>
            </View>
          ) : null}
          {error ? (
            <View style={tw`rounded-2xl bg-rose-50 px-3.5 py-3`} accessibilityLiveRegion="polite">
              <T style={tw`text-xs font-semibold text-rose-500`}>{error}</T>
            </View>
          ) : null}

          {step === 'BASICS' ? (
            <>
              <Card style={tw`gap-4`}>
                <FormField label={t('host.titleLabel')} error={form.title ? issueFor('title') : null}>
                  <Input
                    value={form.title}
                    onChangeText={(v) => set({ title: v })}
                    maxLength={rules.text.titleMax}
                    placeholder={t('host.titlePlaceholder')}
                    accessibilityLabel={t('host.titleLabel')}
                  />
                </FormField>
                <View>
                  <View style={tw`h-6 pt-1`}>
                    <T style={tw`text-xs font-semibold text-ink`}>{t('host.category')}</T>
                  </View>
                  <View style={tw`mt-2 flex-row flex-wrap gap-2`}>
                    {(categories.data ?? []).map((c) => {
                      const active = form.categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => set({ categoryId: c.id })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={c.name}
                          style={[
                            tw`items-center gap-1 rounded-xl py-2.5`,
                            { width: '23.2%', flexGrow: 1 },
                            active ? tw`bg-teal shadow-sm` : [tw`bg-white`, ring(1, color('neutral-200'))],
                          ]}
                        >
                          <T style={tw`text-lg leading-none`}>{emojiFor(c.slug)}</T>
                          <T
                            style={tw`text-[11px] font-semibold ${active ? 'text-white' : 'text-ink'}`}
                            numberOfLines={1}
                          >
                            {c.name}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {/* pb: the design's textarea sits on an inline line box, 7px taller than the field (measured). */}
                <FormField
                  label={t('host.descriptionLabel')}
                  hint={t('host.optional')}
                  style={{ paddingBottom: 7 }}
                >
                  <Input
                    value={form.description}
                    onChangeText={(v) => set({ description: v })}
                    multiline
                    maxLength={rules.text.descriptionMax}
                    placeholder={t('host.descriptionPlaceholder')}
                    accessibilityLabel={t('host.descriptionLabel')}
                    style={tw`h-24`}
                  />
                </FormField>
              </Card>

              <Press
                onPress={() => void addCover()}
                disabled={uploading !== null}
                accessibilityLabel={form.coverUrl ? t('host.changeCover') : t('host.addCover')}
                style={[
                  tw`w-full flex-row items-center gap-3 rounded-2xl bg-white p-4`,
                  ring(1, color('neutral-300')),
                ]}
              >
                <View
                  style={tw`w-11 h-11 rounded-xl bg-mint items-center justify-center overflow-hidden shrink-0`}
                >
                  {form.coverUrl ? (
                    <Image source={{ uri: form.coverUrl }} style={tw`absolute inset-0`} contentFit="cover" />
                  ) : (
                    <Upload color={color('teal')} />
                  )}
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <T style={tw`font-bold text-ink text-sm`}>
                    {form.coverUrl ? t('host.changeCover') : t('host.addCover')}
                  </T>
                  <T style={tw`text-xs text-slate`}>
                    {uploading !== null
                      ? t('submission.uploading', { percent: Math.round(uploading * 100) })
                      : t('host.coverHint')}
                  </T>
                </View>
                <Chevron color={color('slate')} rotate={-90} />
              </Press>
            </>
          ) : null}

          {step === 'PRIZE' ? (
            <>
              <Card style={tw`gap-4`}>
                <FormField
                  label={t('host.prizePool')}
                  hint={t('host.prizeHint')}
                  error={
                    issueFor('prizePoolPaise') && form.prizePoolPaise !== null
                      ? t('host.prizeRange', {
                          min: inr(rules.prizePool.minPaise),
                          max: inr(rules.prizePool.maxPaise),
                        })
                      : null
                  }
                >
                  <Input
                    keyboardType="number-pad"
                    value={rupeeText(form.prizePoolPaise ? String(form.prizePoolPaise / 100) : '')}
                    onChangeText={(v) => {
                      const n = digits(v);
                      set({ prizePoolPaise: n ? Number(n) * 100 : null });
                    }}
                    placeholder="₹ 5,000"
                    accessibilityLabel={t('host.prizePool')}
                  />
                </FormField>
                <View style={tw`flex-row gap-2`}>
                  {rules.prizePool.presetsPaise.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => set({ prizePoolPaise: p })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: form.prizePoolPaise === p }}
                      style={[
                        tw`flex-1 rounded-lg py-2 items-center`,
                        form.prizePoolPaise === p
                          ? tw`bg-teal`
                          : { backgroundColor: 'rgba(232,245,241,0.7)' },
                      ]}
                    >
                      <T
                        style={tw`text-xs font-semibold ${form.prizePoolPaise === p ? 'text-white' : 'text-teal'}`}
                      >
                        {inr(p)}
                      </T>
                    </Pressable>
                  ))}
                </View>
                <FormField
                  label={t('host.entryFee')}
                  hint={t('host.entryHint')}
                  error={issueFor('entryFeePaise')}
                >
                  <Input
                    keyboardType="number-pad"
                    value={rupeeText(form.entryFeeRupees)}
                    onChangeText={(v) => set({ entryFeeRupees: digits(v) })}
                    placeholder="₹ 99"
                    accessibilityLabel={t('host.entryFee')}
                  />
                </FormField>
              </Card>

              {/* The design's gradient card, holding the real split of the pool. */}
              <Gradient
                dir="br"
                colors={[color('teal'), color('teal-dark')]}
                style={tw`rounded-2xl p-4 shadow-sm`}
              >
                <View style={tw`flex-row items-center gap-2`}>
                  <Trophy color="rgba(255,255,255,0.9)" />
                  <T
                    style={[
                      tw`text-xs font-semibold uppercase`,
                      { color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
                    ]}
                  >
                    {t('host.winnersGet')}
                  </T>
                </View>
                {tiers.length > 0 ? (
                  <>
                    <T style={tw`mt-2 text-2xl font-extrabold text-white`}>
                      {t('host.tierHeadline', { count: tiers.length, top: inr(tiers[0]!.amountPaise) })}
                    </T>
                    <T style={[tw`text-xs mt-1`, { color: 'rgba(255,255,255,0.8)' }]}>
                      {tiers.map((tier) => `#${tier.rank} ${inr(tier.amountPaise)}`).join(' · ')}
                    </T>
                  </>
                ) : (
                  <T style={[tw`mt-2 text-xs`, { color: 'rgba(255,255,255,0.8)' }]}>{t('host.tierEmpty')}</T>
                )}
              </Gradient>
            </>
          ) : null}

          {step === 'SCHEDULE' ? (
            <>
              <Card style={tw`gap-4`}>
                <View style={tw`flex-row gap-2`}>
                  <FormField label={t('host.startDate')} style={tw`flex-1`}>
                    <Input
                      value={form.date}
                      onChangeText={(v) => set({ date: v })}
                      placeholder="YYYY-MM-DD"
                      accessibilityLabel={t('host.startDate')}
                      icon={<Calendar size={18} color={color('slate')} />}
                    />
                  </FormField>
                  <FormField label={t('host.startTimeShort')} style={tw`w-28`}>
                    <Input
                      value={form.time}
                      onChangeText={(v) => set({ time: v })}
                      placeholder="18:00"
                      accessibilityLabel={t('host.startTime')}
                    />
                  </FormField>
                </View>
                {issueFor('startAt') ? (
                  <T style={tw`-mt-2 text-[11px] text-rose-500`}>{issueFor('startAt')}</T>
                ) : null}
                <View>
                  <View style={tw`h-6 pt-1`}>
                    <T style={tw`text-xs font-semibold text-ink`}>{t('host.duration')}</T>
                  </View>
                  <View style={tw`mt-2 flex-row gap-2`}>
                    {rules.schedule.durationsDays.map((d) => {
                      const active = form.durationDays === d;
                      return (
                        <Pressable
                          key={d}
                          onPress={() => set({ durationDays: d })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          style={[
                            tw`flex-1 rounded-xl py-2.5 items-center`,
                            active ? tw`bg-teal shadow-sm` : [tw`bg-white`, ring(1, color('neutral-200'))],
                          ]}
                        >
                          <T style={tw`text-[11px] font-semibold ${active ? 'text-white' : 'text-ink'}`}>
                            {durationLabel(d)}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <FormField
                  label={t('host.maxSpots')}
                  hint={t('host.spotsHint')}
                  error={form.maxSpots ? issueFor('maxSpots') && t('host.spotsRange', rules.spots) : null}
                >
                  <Input
                    keyboardType="number-pad"
                    value={form.maxSpots}
                    onChangeText={(v) => set({ maxSpots: digits(v) })}
                    placeholder="200"
                    accessibilityLabel={t('host.maxSpots')}
                    icon={<Users color={color('slate')} />}
                  />
                </FormField>
              </Card>
              {timeline ? <Timeline timeline={timeline} /> : null}
            </>
          ) : null}

          {step === 'REVIEW' ? (
            <>
              <Card style={tw`p-4`}>
                <View style={tw`flex-row items-center gap-3`}>
                  <View
                    style={tw`w-14 h-14 rounded-2xl bg-mint items-center justify-center overflow-hidden shrink-0`}
                  >
                    {form.coverUrl ? (
                      <Image
                        source={{ uri: form.coverUrl }}
                        style={tw`absolute inset-0`}
                        contentFit="cover"
                      />
                    ) : (
                      <T style={tw`text-2xl`}>{emojiFor(category?.slug)}</T>
                    )}
                  </View>
                  <View style={tw`min-w-0 flex-1`}>
                    <T style={tw`font-extrabold text-ink leading-tight`}>
                      {form.title || t('host.untitled')}
                    </T>
                    <T style={tw`text-xs text-slate mt-0.5`}>
                      {t('host.hostedByYou', { category: category?.name ?? t('host.noCategory') })}
                    </T>
                  </View>
                </View>
                {form.description ? (
                  <T style={tw`text-xs text-slate mt-3 leading-relaxed`}>{form.description}</T>
                ) : null}
              </Card>

              <Card style={tw`p-0 overflow-hidden`}>
                {[
                  [t('host.prizePool'), inr(form.prizePoolPaise ?? 0)],
                  [t('host.entryFeeShort'), entryFeePaise ? inr(entryFeePaise) : t('common.free')],
                  [t('host.starts'), formatDateTime(startIso(form))],
                  [t('host.duration'), durationLabel(form.durationDays)],
                  [t('host.maxSpots'), form.maxSpots || '—'],
                ].map(([k, v], i) => (
                  <View
                    key={k}
                    style={tw`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-neutral-100' : ''}`}
                  >
                    <T style={tw`text-xs text-slate`}>{k}</T>
                    <T style={tw`text-sm font-bold text-ink`}>{v}</T>
                  </View>
                ))}
              </Card>

              {tiers.length > 0 ? (
                <Card style={tw`p-0 overflow-hidden`}>
                  <T style={tw`px-4 pt-3 pb-1 text-xs font-semibold text-ink`}>{t('host.tiers')}</T>
                  {tiers.map((tier) => (
                    <View key={tier.rank} style={tw`flex-row items-center justify-between px-4 py-2`}>
                      <T style={tw`text-xs text-slate`}>{t('detail.rank', { rank: tier.rank })}</T>
                      <T style={tw`text-sm font-bold text-teal`}>{inr(tier.amountPaise)}</T>
                    </View>
                  ))}
                  <View style={tw`h-2`} />
                </Card>
              ) : null}
              {timeline ? <Timeline timeline={timeline} /> : null}

              {issues.map((i) => (
                <Pressable
                  key={i.field}
                  onPress={() => setStep(i.step)}
                  accessibilityRole="button"
                  style={tw`rounded-2xl bg-amber-50 px-3.5 py-3 flex-row items-center gap-2`}
                >
                  <T style={tw`flex-1 text-xs font-semibold text-amber-700`}>
                    {t(`host.steps.${i.step}`)}: {i.message || t('errors.VALIDATION_FAILED')}
                  </T>
                  <Chevron size={14} color={color('amber-700')} rotate={-90} />
                </Pressable>
              ))}

              <T style={tw`text-[11px] text-slate text-center px-6 leading-relaxed`}>
                {editingLive ? t('host.editNote') : t('host.publishNote')}
              </T>
            </>
          ) : null}
        </ScrollView>

        {/* Sticky action bar */}
        <View
          style={[
            tw`border-t px-4 pt-3 pb-5`,
            { borderColor: 'rgba(229,229,229,0.7)', backgroundColor: 'rgba(242,244,245,0.8)' },
          ]}
        >
          <Pressable
            onPress={cta.onPress}
            disabled={blocked || busy || uploading !== null}
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked || busy, busy }}
            style={({ pressed }) => [
              tw`w-full rounded-xl py-3.5 items-center justify-center flex-row gap-2`,
              blocked ? tw`bg-neutral-200` : tw`bg-teal shadow-sm`,
              busy && tw`opacity-70`,
              pressed && !blocked && { transform: [{ scale: 0.99 }] },
            ]}
          >
            <T style={tw`text-sm font-bold ${blocked ? 'text-slate' : 'text-white'}`}>{cta.title}</T>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Reads a competition fresh (no cache) while waiting for funding to land. */
const peek = (id: string) => api<CompetitionDetail>(`/v1/competitions/${id}`);

function LiveStat({
  value,
  label,
  accent,
  divider,
}: {
  value: string;
  label: string;
  accent?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[tw`items-center`, divider && tw`border-l border-neutral-100 pl-6`]}>
      <T style={tw`${accent ? 'text-teal' : 'text-ink'} font-extrabold text-lg leading-none`}>{value}</T>
      <T style={tw`text-[11px] text-slate mt-1`}>{label}</T>
    </View>
  );
}

function Timeline({ timeline }: { timeline: ReturnType<typeof deriveTimeline> }) {
  const { t } = useTranslation();
  const rows: [string, Date][] = [
    [t('detail.registrationOpens'), timeline.registrationOpensAt],
    [t('detail.registrationCloses'), timeline.registrationClosesAt],
    [t('detail.submissionsClose'), timeline.submissionEndsAt],
    [t('detail.resultsDue'), timeline.resultsDueAt],
  ];
  return (
    <Card style={tw`p-0 overflow-hidden`}>
      <View style={tw`flex-row items-center gap-2 px-4 pt-3 pb-1`}>
        <Calendar size={16} color={color('teal')} />
        <T style={tw`text-xs font-semibold text-ink`}>{t('host.timeline')}</T>
      </View>
      {rows.map(([label, at]): ReactNode => (
        <View key={label} style={tw`flex-row items-center justify-between px-4 py-2`}>
          <T style={tw`text-xs text-slate`}>{label}</T>
          <T style={tw`text-xs font-bold text-ink`}>{formatDateTime(at.toISOString())}</T>
        </View>
      ))}
      <View style={tw`h-2`} />
    </Card>
  );
}

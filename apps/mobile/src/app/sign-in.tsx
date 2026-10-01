import {
  completeSignupSchema,
  type MeResponse,
  requestOtpSchema,
  type RequestOtpResponse,
  verifyOtpSchema,
  type VerifyOtpResponse,
} from '@feedants/shared';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { Input, Press, Spinner } from '@/design/components';
import { Chevron, Mail } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color, ring } from '@/design/tw';
import { errorMessage } from '@/lib/format';

type Step = 'email' | 'code' | 'name';
const OTP_LEN = 6;

/**
 * US-01, US-02: email → 6-digit code → (first time) display name → back where you were.
 * design/prototype/src/pages/LoginPage.tsx, OtpVerificationPage.tsx and SignUpPage.tsx
 * share one shell; Feedants signs in with emailed one-time codes, so the password, phone,
 * Google and "keep me signed in" controls are left out.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const done = () => {
    const back = session.returnTo;
    session.setReturnTo(null);
    router.dismissAll?.();
    if (back) router.push(back as never);
    else router.replace('/(tabs)');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OTP_INCORRECT') {
        const left = (e.details as { attemptsRemaining?: number } | undefined)?.attemptsRemaining ?? 0;
        setError(t('auth.attemptsLeft', { count: left }));
        setCode('');
      } else setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const parsed = requestOtpSchema.safeParse({ email });
      if (!parsed.success) throw new ApiError(400, 'VALIDATION_FAILED', 'email');
      const res = await api<RequestOtpResponse>('/v1/auth/otp/request', {
        method: 'POST',
        body: parsed.data,
        auth: 'none',
      });
      setEmail(parsed.data.email);
      setResendAt(Date.now() + res.resendAfterSeconds * 1000);
      setCode('');
      setStep('code');
    });

  const verify = (value = code) =>
    run(async () => {
      const parsed = verifyOtpSchema.safeParse({ email, code: value });
      if (!parsed.success) throw new ApiError(400, 'VALIDATION_FAILED', 'code');
      const res = await api<VerifyOtpResponse>('/v1/auth/otp/verify', {
        method: 'POST',
        body: parsed.data,
        auth: 'none',
      });
      await session.signedIn(res);
      if (res.needsDisplayName) setStep('name');
      else done();
    });

  const saveName = () =>
    run(async () => {
      const parsed = completeSignupSchema.safeParse({ displayName: name });
      if (!parsed.success) throw new ApiError(400, 'VALIDATION_FAILED', 'name');
      const me = await api<MeResponse>('/v1/auth/complete-signup', { method: 'POST', body: parsed.data });
      session.setUser(me);
      done();
    });

  const back = () => {
    setError(null);
    if (step === 'code') setStep('email');
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View style={tw`flex-1 bg-canvas`}>
      <ScrollView
        contentContainerStyle={tw`w-full max-w-[430px] self-center pb-10`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'email' ? (
          <Hero tile={<T style={tw`text-2xl font-extrabold text-white`}>F</T>} title={t('auth.welcome')}>
            {t('auth.welcomeBody')}
          </Hero>
        ) : step === 'code' ? (
          <Hero tile={<Mail size={24} color="#fff" />} onBack={back} title={t('auth.verifyTitle')}>
            {t('auth.sentTo')}
            <T style={tw`font-semibold text-white`}>{email}</T>
          </Hero>
        ) : (
          <Hero tile={<T style={tw`text-2xl font-extrabold text-white`}>F</T>} title={t('auth.nameTitle')}>
            {t('auth.nameSubtitle')}
          </Hero>
        )}

        <View style={tw`px-6 -mt-4`}>
          <View style={tw`rounded-3xl bg-white shadow-sm p-5 gap-4`}>
            {step === 'email' ? (
              <>
                <View>
                  <T style={tw`text-xs font-semibold text-slate`}>{t('auth.email')}</T>
                  <View style={tw`mt-1.5`}>
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@feedants.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      onSubmitEditing={() => void sendCode()}
                      autoFocus
                      accessibilityLabel={t('auth.email')}
                      style={tw`pl-10 py-3.5`}
                    />
                    <View
                      style={[tw`absolute left-3.5 top-0 bottom-0 justify-center`, { pointerEvents: 'none' }]}
                    >
                      <Mail size={18} color={color('slate')} />
                    </View>
                  </View>
                  <T style={tw`mt-1.5 text-[11px] text-slate`}>{t('auth.codeHint')}</T>
                </View>
                <ErrorLine error={error} />
                <PrimaryButton
                  title={busy ? t('auth.sending') : t('common.continue')}
                  onPress={() => void sendCode()}
                  busy={busy}
                  disabled={email.trim().length < 3}
                />
              </>
            ) : null}

            {step === 'code' ? (
              <>
                <View>
                  <T style={tw`text-xs font-semibold text-slate`}>{t('auth.enterCode')}</T>
                  <CodeBoxes
                    value={code}
                    error={!!error}
                    onChange={(v) => {
                      setError(null);
                      setCode(v);
                      if (v.length === OTP_LEN && !busy) void verify(v);
                    }}
                  />
                </View>
                <ErrorLine error={error} />
                <PrimaryButton
                  title={busy ? t('auth.verifying') : t('auth.verify')}
                  onPress={() => void verify()}
                  busy={busy}
                  disabled={code.length !== OTP_LEN}
                />
                <View style={tw`items-center`}>
                  {resendIn > 0 ? (
                    <T style={tw`text-sm text-slate`}>
                      {t('auth.resendInPrefix')}
                      <T style={[tw`font-bold text-ink`, { fontVariant: ['tabular-nums'] }]}>
                        0:{String(resendIn).padStart(2, '0')}
                      </T>
                    </T>
                  ) : (
                    <Pressable
                      onPress={() => void sendCode()}
                      disabled={busy}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <T style={tw`text-sm font-bold text-teal`}>{t('auth.resend')}</T>
                    </Pressable>
                  )}
                </View>
              </>
            ) : null}

            {step === 'name' ? (
              <>
                <View>
                  <T style={tw`text-xs font-semibold text-slate`}>{t('auth.displayName')}</T>
                  <View style={tw`mt-1.5`}>
                    <Input
                      value={name}
                      onChangeText={setName}
                      placeholder={t('auth.namePlaceholder')}
                      autoComplete="name"
                      maxLength={40}
                      autoFocus
                      onSubmitEditing={() => void saveName()}
                      accessibilityLabel={t('auth.displayName')}
                      style={tw`py-3.5`}
                    />
                  </View>
                </View>
                <ErrorLine error={error} />
                <PrimaryButton
                  title={t('auth.finish')}
                  onPress={() => void saveName()}
                  busy={busy}
                  disabled={name.trim().length < 2}
                />
              </>
            ) : null}
          </View>

          {step === 'code' ? (
            <Pressable onPress={back} accessibilityRole="button" style={tw`mt-5 items-center`}>
              <T style={tw`text-sm text-slate`}>
                {t('auth.wrongEmail')}
                <T style={tw`font-bold text-teal`}>{t('auth.changeIt')}</T>
              </T>
            </Pressable>
          ) : null}

          {step === 'email' ? (
            <T style={tw`mt-6 text-center text-sm text-slate`}>
              {t('auth.newHere')}
              <T style={tw`font-bold text-teal`}>{t('auth.newHereBold')}</T>
            </T>
          ) : null}

          <T style={tw`mt-4 text-center text-[11px] leading-relaxed text-slate px-4`}>
            {t('auth.agreeBefore')}
            <T style={tw`font-semibold text-ink`} onPress={() => router.push('/legal/terms')}>
              {t('auth.terms')}
            </T>
            {t('auth.agreeMiddle')}
            <T style={tw`font-semibold text-ink`} onPress={() => router.push('/legal/privacy')}>
              {t('auth.privacy')}
            </T>
            .
          </T>
          <T style={tw`mt-2 text-center text-[11px] text-slate px-4`}>{t('auth.testMode')}</T>
        </View>
      </ScrollView>
    </View>
  );
}

/** The shared teal header: decorative orbs, optional back button, icon tile, title, line. */
function Hero({
  tile,
  title,
  onBack,
  children,
}: {
  tile: ReactNode;
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        tw`overflow-hidden bg-teal px-6 pb-10`,
        {
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          paddingTop: insets.top + (onBack ? 48 : 56),
        },
      ]}
    >
      <View
        style={[
          tw`absolute -right-12 -top-14 w-44 h-44 rounded-full`,
          { backgroundColor: 'rgba(255,255,255,0.1)' },
        ]}
      />
      <View
        style={[
          tw`absolute -left-10 w-28 h-28 rounded-full`,
          { bottom: -40, backgroundColor: 'rgba(255,255,255,0.1)' },
        ]}
      />
      {onBack ? (
        <Press
          onPress={onBack}
          accessibilityLabel={t('common.back')}
          scale={0.95}
          style={[
            tw`w-10 h-10 mb-5 items-center justify-center rounded-full`,
            { backgroundColor: 'rgba(255,255,255,0.15)' },
            ring(1, 'rgba(255,255,255,0.25)'),
          ]}
        >
          <Chevron size={20} color="#fff" rotate={90} />
        </Press>
      ) : null}
      <View
        style={[
          tw`w-12 h-12 items-center justify-center rounded-2xl`,
          { backgroundColor: 'rgba(255,255,255,0.15)' },
          ring(1, 'rgba(255,255,255,0.25)'),
        ]}
      >
        {tile}
      </View>
      <T style={tw`mt-5 text-3xl font-extrabold leading-tight text-white`} accessibilityRole="header">
        {title}
      </T>
      <T style={[tw`mt-1.5 text-sm`, { color: 'rgba(255,255,255,0.8)' }]}>{children}</T>
    </View>
  );
}

/** OtpVerificationPage boxes: six `h-14` cells over one hidden input that takes typing and paste. */
function CodeBoxes({
  value,
  error,
  onChange,
}: {
  value: string;
  error: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(true);
  const digits = value.split('');
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={tw`mt-3`}>
      <View style={tw`flex-row justify-between gap-2`}>
        {Array.from({ length: OTP_LEN }, (_, i) => {
          const active = focused && i === Math.min(digits.length, OTP_LEN - 1) && digits.length < OTP_LEN;
          return (
            <View
              key={i}
              style={[
                tw`h-14 flex-1 rounded-xl bg-canvas items-center justify-center`,
                error
                  ? ring(1, color('rose-300'))
                  : active
                    ? ring(2, color('teal'))
                    : digits[i]
                      ? ring(1, color('teal'))
                      : ring(1, color('neutral-200')),
              ]}
            >
              {digits[i] ? (
                <T style={tw`text-xl font-extrabold text-ink`}>{digits[i]}</T>
              ) : active ? (
                <View style={tw`w-px h-6 bg-ink`} />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, OTP_LEN))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LEN}
        autoFocus
        caretHidden
        accessibilityLabel={t('auth.enterCode')}
        style={[
          tw`absolute inset-0`,
          { opacity: 0.01, color: 'transparent' },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
    </Pressable>
  );
}

function PrimaryButton({
  title,
  onPress,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityState={{ disabled: busy || disabled, busy }}
      style={[
        tw`w-full rounded-xl bg-teal py-3.5 items-center justify-center flex-row gap-2`,
        (busy || disabled) && tw`opacity-60`,
      ]}
    >
      {busy ? <Spinner /> : null}
      <T style={tw`text-sm font-bold text-white`}>{title}</T>
    </Press>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <T style={tw`-mt-1 text-[11px] font-medium text-rose-500`} accessibilityLiveRegion="polite">
      {error}
    </T>
  );
}

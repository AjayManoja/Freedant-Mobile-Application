import {
  completeSignupSchema,
  type MeResponse,
  requestOtpSchema,
  type RequestOtpResponse,
  verifyOtpSchema,
  type VerifyOtpResponse,
} from '@feedants/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { api, ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { AppText, Button, Field, Header, Notice, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { colors } from '@/theme/tokens';

type Step = 'email' | 'code' | 'name';

/** US-01, US-02: email → 6-digit code → (first time) display name → back where you were. */
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

  const verify = () =>
    run(async () => {
      const parsed = verifyOtpSchema.safeParse({ email, code });
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

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t(step === 'email' ? 'auth.title' : step === 'code' ? 'auth.verifyTitle' : 'auth.nameTitle')}
        onBack={step === 'code' ? () => setStep('email') : step === 'email' ? () => router.back() : undefined}
      />
      <AppText variant="body">
        {step === 'email'
          ? t('auth.subtitle')
          : step === 'code'
            ? t('auth.verifySubtitle', { email })
            : t('auth.nameSubtitle')}
      </AppText>

      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      {step === 'email' ? (
        <>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
            autoFocus
          />
          <Button
            title={t('auth.sendCode')}
            onPress={sendCode}
            loading={busy}
            disabled={email.trim().length < 3}
          />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <Field
            label={t('auth.code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            style={styles.code}
            onSubmitEditing={verify}
            autoFocus
          />
          <Button title={t('auth.verify')} onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Pressable
            onPress={sendCode}
            disabled={resendIn > 0 || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendIn > 0 }}
            style={styles.resend}
          >
            <AppText variant="bodyStrong" color={resendIn > 0 ? colors.slate : colors.teal}>
              {resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
            </AppText>
          </Pressable>
        </>
      ) : null}

      {step === 'name' ? (
        <>
          <Field
            label={t('auth.displayName')}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={40}
            autoFocus
          />
          <Button
            title={t('auth.finish')}
            onPress={saveName}
            loading={busy}
            disabled={name.trim().length < 2}
          />
        </>
      ) : null}

      <AppText variant="caption" style={styles.center}>
        {t('auth.legal')}
      </AppText>
      <AppText variant="caption" style={styles.center}>
        {t('auth.testMode')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  resend: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});

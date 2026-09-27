import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

type Step = 'request' | 'code' | 'reset' | 'done'
type Method = 'email' | 'phone'

const OTP_LEN = 6
const RESEND_SECONDS = 30

const inputWrap =
  'flex items-center gap-2.5 rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 focus-within:ring-2 focus-within:ring-teal transition'
const inputCls =
  'flex-1 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-slate'

function Lock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}
function Eye({ off }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
          <path d="M9.4 5.2A9 9 0 0112 5c5 0 9 5 9 7a12 12 0 01-2.2 2.9M6.1 6.1C3.9 7.5 3 11 3 12c0 1 4 5 9 5a9 9 0 003-.5" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('request')

  const [method, setMethod] = useState<Method>('email')
  const [contact, setContact] = useState('')
  const [contactError, setContactError] = useState('')

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''))
  const [codeError, setCodeError] = useState('')
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [resetTouched, setResetTouched] = useState(false)

  const [busy, setBusy] = useState(false)

  // Countdown while on the code step.
  useEffect(() => {
    if (step !== 'code' || seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [step, seconds])

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault()
    const v = contact.trim()
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setContactError('Enter a valid email')
      return
    }
    if (method === 'phone' && v.replace(/\D/g, '').length < 10) {
      setContactError('Enter a valid phone number')
      return
    }
    setContactError('')
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setSeconds(RESEND_SECONDS)
      setStep('code')
      setTimeout(() => inputs.current[0]?.focus(), 50)
    }, 700)
  }

  const code = digits.join('')
  const setAt = (i: number, val: string) => {
    setCodeError('')
    setDigits((prev) => {
      const next = [...prev]
      next[i] = val
      return next
    })
  }
  const onCodeChange = (i: number, raw: string) => {
    const val = raw.replace(/\D/g, '')
    if (!val) return setAt(i, '')
    if (val.length > 1) {
      const chars = val.slice(0, OTP_LEN).split('')
      setDigits((prev) => {
        const filled = [...prev]
        chars.forEach((c, k) => {
          if (i + k < OTP_LEN) filled[i + k] = c
        })
        return filled
      })
      inputs.current[Math.min(i + chars.length, OTP_LEN - 1)]?.focus()
      return
    }
    setAt(i, val)
    if (i < OTP_LEN - 1) inputs.current[i + 1]?.focus()
  }
  const onCodeKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
      setAt(i - 1, '')
    }
  }
  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== OTP_LEN) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      if (code === '000000') {
        setCodeError('That code is incorrect. Please try again.')
        setDigits(Array(OTP_LEN).fill(''))
        inputs.current[0]?.focus()
        return
      }
      setStep('reset')
    }, 700)
  }

  const resetErrors = {
    password: password.length < 8 ? 'Use at least 8 characters' : '',
    confirm: confirm !== password ? 'Passwords do not match' : '',
  }
  const resetValid = !resetErrors.password && !resetErrors.confirm
  const submitReset = (e: React.FormEvent) => {
    e.preventDefault()
    setResetTouched(true)
    if (!resetValid) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setStep('done')
    }, 700)
  }

  const heading = useMemo(() => {
    switch (step) {
      case 'request':
        return { title: 'Reset your password', sub: "Enter your account details and we'll send you a reset code." }
      case 'code':
        return { title: 'Enter reset code', sub: `We sent a 6-digit code to ${contact}` }
      case 'reset':
        return { title: 'Set a new password', sub: 'Choose a strong password you haven’t used before.' }
      case 'done':
        return { title: 'Password updated', sub: 'You can now sign in with your new password.' }
    }
  }, [step, contact])

  return (
    <div className="flex-1 flex flex-col bg-canvas">
      {/* Header */}
      <div className="relative overflow-hidden bg-teal text-white px-6 pt-12 pb-10 rounded-b-[2rem]">
        <div className="absolute -right-12 -top-14 w-44 h-44 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-[-40px] w-28 h-28 rounded-full bg-white/10" />
        {step !== 'done' && (
          <button
            onClick={() => (step === 'request' ? navigate('/login') : setStep(step === 'reset' ? 'code' : 'request'))}
            aria-label="Go back"
            className="relative flex w-10 h-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
        <div className="relative mt-5">
          <h1 className="text-3xl font-extrabold leading-tight">{heading.title}</h1>
          <p className="mt-1.5 text-sm text-white/80">{heading.sub}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10 -mt-4" data-scroll>
        {step === 'request' && (
          <form onSubmit={sendCode} className="rounded-3xl bg-white shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
              {(['email', 'phone'] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m)
                    setContact('')
                    setContactError('')
                  }}
                  className={`rounded-lg py-2 text-sm font-bold capitalize transition ${
                    method === m ? 'bg-white text-teal shadow-sm' : 'text-slate'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate">
                {method === 'email' ? 'Email address' : 'Phone number'}
              </label>
              <div className={`mt-1.5 ${inputWrap}`}>
                {method === 'phone' && (
                  <>
                    <span className="text-sm font-semibold text-slate">+91</span>
                    <span className="h-5 w-px bg-neutral-200" />
                  </>
                )}
                <input
                  className={inputCls}
                  type={method === 'email' ? 'email' : 'tel'}
                  inputMode={method === 'email' ? 'email' : 'numeric'}
                  placeholder={method === 'email' ? 'you@feedants.com' : '98765 43210'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
              {contactError && (
                <p className="mt-1 text-[11px] font-medium text-rose-500">{contactError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-70"
            >
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode} className="rounded-3xl bg-white shadow-sm p-5">
            <label className="text-xs font-semibold text-slate">Verification code</label>
            <div className="mt-3 flex justify-between gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el
                  }}
                  value={d}
                  onChange={(e) => onCodeChange(i, e.target.value)}
                  onKeyDown={(e) => onCodeKey(i, e)}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={OTP_LEN}
                  className={`h-14 w-full rounded-xl bg-canvas text-center text-xl font-extrabold text-ink outline-none ring-1 transition ${
                    codeError ? 'ring-rose-300' : d ? 'ring-teal' : 'ring-neutral-200 focus:ring-2 focus:ring-teal'
                  }`}
                />
              ))}
            </div>
            {codeError && <p className="mt-3 text-[11px] font-medium text-rose-500">{codeError}</p>}

            <button
              type="submit"
              disabled={code.length !== OTP_LEN || busy}
              className="mt-5 w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>

            <div className="mt-4 text-center text-sm">
              {seconds > 0 ? (
                <p className="text-slate">
                  Resend in{' '}
                  <span className="font-bold text-ink tabular-nums">
                    0:{seconds.toString().padStart(2, '0')}
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSeconds(RESEND_SECONDS)
                    setDigits(Array(OTP_LEN).fill(''))
                    setCodeError('')
                    inputs.current[0]?.focus()
                  }}
                  className="font-bold text-teal"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="rounded-3xl bg-white shadow-sm p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate">New password</label>
              <div className={`mt-1.5 ${inputWrap}`}>
                <span className="text-slate"><Lock /></span>
                <input
                  className={inputCls}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="text-slate active:scale-90 transition"
                >
                  <Eye off={show} />
                </button>
              </div>
              {resetTouched && resetErrors.password && (
                <p className="mt-1 text-[11px] font-medium text-rose-500">{resetErrors.password}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate">Confirm password</label>
              <div className={`mt-1.5 ${inputWrap}`}>
                <span className="text-slate"><Lock /></span>
                <input
                  className={inputCls}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {resetTouched && resetErrors.confirm && (
                <p className="mt-1 text-[11px] font-medium text-rose-500">{resetErrors.confirm}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-70"
            >
              {busy ? 'Updating…' : 'Reset password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="rounded-3xl bg-white shadow-sm p-6 text-center">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-mint text-teal">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-11" />
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-ink">All set!</h2>
            <p className="mt-1 text-sm text-slate px-4">
              Your password has been updated successfully.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-5 w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition"
            >
              Back to sign in
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-6 text-center text-sm text-slate">
            Remembered it?{' '}
            <button onClick={() => navigate('/login')} className="font-bold text-teal">
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

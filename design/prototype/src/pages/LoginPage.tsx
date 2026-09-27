import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

type Mode = 'email' | 'phone'

// Small inline glyphs — the shared ui.tsx set doesn't include lock/eye/google,
// and these want their own sizing/stroke, so they live here.
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
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.3 28.6a14.5 14.5 0 010-9.2l-7.8-6.1a24 24 0 000 21.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.8-4.1-13.7-9.8l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}

const inputWrap =
  'flex items-center gap-2.5 rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 focus-within:ring-2 focus-within:ring-teal transition'
const inputCls =
  'flex-1 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-slate'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('email')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  const idError = useMemo(() => {
    const v = identifier.trim()
    if (!v) return `Enter your ${mode === 'email' ? 'email' : 'phone number'}`
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return 'Enter a valid email'
    if (mode === 'phone' && v.replace(/\D/g, '').length < 10)
      return 'Enter a valid phone number'
    return ''
  }, [identifier, mode])

  const pwError = !password ? 'Enter your password' : ''
  const valid = !idError && !pwError

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    setLoading(true)
    // Simulated auth — hand off to the app after a beat.
    setTimeout(() => navigate('/'), 900)
  }

  return (
    <div className="flex-1 flex flex-col bg-canvas">
      {/* Teal brand header with soft decorative orbs */}
      <div className="relative overflow-hidden bg-teal text-white px-6 pt-14 pb-10 rounded-b-[2rem]">
        <div className="absolute -right-12 -top-14 w-44 h-44 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-[-40px] w-28 h-28 rounded-full bg-white/10" />
        <div className="relative">
          <span className="flex w-12 h-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold ring-1 ring-white/25">
            F
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-white/80">
            Sign in to enter competitions, track your submissions and claim your
            wins.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10 -mt-4" data-scroll>
        <form
          onSubmit={submit}
          className="rounded-3xl bg-white shadow-sm p-5 space-y-4"
        >
          {/* Email / phone segmented toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
            {(['email', 'phone'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setIdentifier('')
                }}
                className={`rounded-lg py-2 text-sm font-bold capitalize transition ${
                  mode === m
                    ? 'bg-white text-teal shadow-sm'
                    : 'text-slate'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Identifier */}
          <div>
            <label className="text-xs font-semibold text-slate">
              {mode === 'email' ? 'Email address' : 'Phone number'}
            </label>
            <div className={`mt-1.5 ${inputWrap}`}>
              <span className="text-slate">
                {mode === 'email' ? <MailGlyph /> : <PhoneGlyph />}
              </span>
              <input
                className={inputCls}
                type={mode === 'email' ? 'email' : 'tel'}
                inputMode={mode === 'email' ? 'email' : 'tel'}
                autoComplete={mode === 'email' ? 'email' : 'tel'}
                placeholder={
                  mode === 'email' ? 'you@feedants.com' : '+91 98765 43210'
                }
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            {touched && idError && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">
                {idError}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate">Password</label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs font-semibold text-teal"
              >
                Forgot password?
              </button>
            </div>
            <div className={`mt-1.5 ${inputWrap}`}>
              <span className="text-slate">
                <Lock />
              </span>
              <input
                className={inputCls}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
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
            {touched && pwError && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">
                {pwError}
              </p>
            )}
          </div>

          {/* Remember me */}
          <button
            type="button"
            onClick={() => setRemember((v) => !v)}
            className="flex items-center gap-2.5"
          >
            <span
              className={`flex w-5 h-5 items-center justify-center rounded-md ring-1 transition ${
                remember
                  ? 'bg-teal ring-teal text-white'
                  : 'bg-white ring-neutral-300 text-transparent'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-11" />
              </svg>
            </span>
            <span className="text-sm text-ink">Keep me signed in</span>
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Continue'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-0.5">
            <span className="h-px flex-1 bg-neutral-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate">
              or
            </span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => setTimeout(() => navigate('/'), 700)}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white ring-1 ring-neutral-200 py-3.5 text-sm font-bold text-ink active:scale-[0.99] transition"
          >
            <GoogleMark />
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate">
          New to Feedants?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="font-bold text-teal"
          >
            Create an account
          </button>
        </p>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate px-4">
          By continuing you agree to our{' '}
          <span className="font-semibold text-ink">Terms</span> and{' '}
          <span className="font-semibold text-ink">Privacy Policy</span>.
        </p>
      </div>
    </div>
  )
}

// Local icon glyphs sized for the input rows.
function MailGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
function PhoneGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 011-2z" />
    </svg>
  )
}

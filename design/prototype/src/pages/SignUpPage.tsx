import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

type Role = 'creator' | 'host'

// Local input glyphs — the shared ui.tsx set doesn't cover these, and they want
// their own sizing/stroke tuned for the input rows.
function UserGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  )
}
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

const inputWrap =
  'flex items-center gap-2.5 rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 focus-within:ring-2 focus-within:ring-teal transition'
const inputCls =
  'flex-1 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-slate'

const roles: {
  id: Role
  label: string
  sub: string
  icon: React.ReactNode
}[] = [
  {
    id: 'creator',
    label: 'Creator',
    sub: 'Enter competitions & win prizes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
      </svg>
    ),
  },
  {
    id: 'host',
    label: 'Host',
    sub: 'Run competitions & judge entries',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
        <path d="M17 5h2a2 2 0 01-2 4M7 5H5a2 2 0 002 4M9 15h6M12 13v2M9 20h6" />
      </svg>
    ),
  },
]

// Strength meter thresholds → label + bar color.
function scorePassword(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('creator')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [agree, setAgree] = useState(false)
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  const digits = phone.replace(/\D/g, '')
  const errors = {
    name: !name.trim() ? 'Enter your full name' : '',
    email:
      !email.trim()
        ? 'Enter your email'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? 'Enter a valid email'
          : '',
    phone: digits.length < 10 ? 'Enter a valid 10-digit number' : '',
    password: password.length < 8 ? 'Use at least 8 characters' : '',
    agree: !agree ? 'Please accept the terms to continue' : '',
  }
  const valid = Object.values(errors).every((e) => !e)

  const strength = useMemo(() => scorePassword(password), [password])
  const strengthMeta = [
    { label: 'Too short', color: 'bg-rose-400' },
    { label: 'Weak', color: 'bg-rose-400' },
    { label: 'Fair', color: 'bg-amber-400' },
    { label: 'Good', color: 'bg-teal' },
    { label: 'Strong', color: 'bg-teal' },
  ][strength]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    setLoading(true)
    // Simulated registration → route into phone verification (payments-critical).
    setTimeout(
      () =>
        navigate('/verify', {
          state: { phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5, 10)}`, role },
        }),
      800,
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-canvas">
      {/* Brand header */}
      <div className="relative overflow-hidden bg-teal text-white px-6 pt-14 pb-10 rounded-b-[2rem]">
        <div className="absolute -right-12 -top-14 w-44 h-44 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-[-40px] w-28 h-28 rounded-full bg-white/10" />
        <div className="relative">
          <span className="flex w-12 h-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold ring-1 ring-white/25">
            F
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-white/80">
            Join Feedants to compete, host and win — it takes less than a minute.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10 -mt-4" data-scroll>
        <form
          onSubmit={submit}
          className="rounded-3xl bg-white shadow-sm p-5 space-y-4"
        >
          {/* Role picker */}
          <div>
            <p className="text-xs font-semibold text-slate mb-2">I want to join as</p>
            <div className="grid grid-cols-2 gap-2.5">
              {roles.map((r) => {
                const active = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`rounded-2xl p-3.5 text-left ring-1 transition ${
                      active
                        ? 'bg-mint ring-teal'
                        : 'bg-white ring-neutral-200'
                    }`}
                  >
                    <span
                      className={`flex w-10 h-10 items-center justify-center rounded-xl ${
                        active ? 'bg-teal text-white' : 'bg-canvas text-slate'
                      }`}
                    >
                      {r.icon}
                    </span>
                    <p className="mt-2.5 text-sm font-bold text-ink">{r.label}</p>
                    <p className="text-[11px] text-slate leading-tight mt-0.5">
                      {r.sub}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Full name" error={touched ? errors.name : ''}>
            <div className={inputWrap}>
              <span className="text-slate"><UserGlyph /></span>
              <input
                className={inputCls}
                autoComplete="name"
                placeholder="e.g. Neha Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Email address" error={touched ? errors.email : ''}>
            <div className={inputWrap}>
              <span className="text-slate"><MailGlyph /></span>
              <input
                className={inputCls}
                type="email"
                autoComplete="email"
                placeholder="you@feedants.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Phone number" error={touched ? errors.phone : ''}>
            <div className={inputWrap}>
              <span className="text-sm font-semibold text-slate">+91</span>
              <span className="h-5 w-px bg-neutral-200" />
              <input
                className={inputCls}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))}
                maxLength={11}
              />
            </div>
          </Field>

          <Field label="Password" error={touched ? errors.password : ''}>
            <div className={inputWrap}>
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
            {password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < strength ? strengthMeta.color : 'bg-neutral-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-slate w-16 text-right">
                  {strengthMeta.label}
                </span>
              </div>
            )}
          </Field>

          {/* Terms */}
          <button
            type="button"
            onClick={() => setAgree((v) => !v)}
            className="flex items-start gap-2.5 text-left"
          >
            <span
              className={`mt-0.5 flex w-5 h-5 shrink-0 items-center justify-center rounded-md ring-1 transition ${
                agree
                  ? 'bg-teal ring-teal text-white'
                  : 'bg-white ring-neutral-300 text-transparent'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-11" />
              </svg>
            </span>
            <span className="text-xs text-slate leading-relaxed">
              I agree to Feedants'{' '}
              <span className="font-semibold text-ink">Terms of Service</span> and{' '}
              <span className="font-semibold text-ink">Privacy Policy</span>.
            </span>
          </button>
          {touched && errors.agree && (
            <p className="-mt-2 text-[11px] font-medium text-rose-500">
              {errors.agree}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-70"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="font-bold text-teal">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-[11px] font-medium text-rose-500">{error}</p>
      )}
    </div>
  )
}

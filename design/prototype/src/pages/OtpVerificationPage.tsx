import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

const OTP_LEN = 6
const RESEND_SECONDS = 30

export default function OtpVerificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as { phone?: string; next?: string }
  const phone = state.phone || '+91 98765 43210'
  const next = state.next || '/'

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''))
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // Resend countdown.
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const code = digits.join('')
  const full = code.length === OTP_LEN

  const setAt = (i: number, val: string) => {
    setError('')
    setDigits((prev) => {
      const nextDigits = [...prev]
      nextDigits[i] = val
      return nextDigits
    })
  }

  const onChange = (i: number, raw: string) => {
    const val = raw.replace(/\D/g, '')
    if (!val) {
      setAt(i, '')
      return
    }
    // Support paste of the whole code into one box.
    if (val.length > 1) {
      const chars = val.slice(0, OTP_LEN).split('')
      setDigits((prev) => {
        const filled = [...prev]
        chars.forEach((c, k) => {
          if (i + k < OTP_LEN) filled[i + k] = c
        })
        return filled
      })
      const last = Math.min(i + chars.length, OTP_LEN - 1)
      inputs.current[last]?.focus()
      return
    }
    setAt(i, val)
    if (i < OTP_LEN - 1) inputs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
      setAt(i - 1, '')
    }
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < OTP_LEN - 1) inputs.current[i + 1]?.focus()
  }

  const verify = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!full) return
    setVerifying(true)
    // Simulated check — treat "000000" as an invalid code for demonstration.
    setTimeout(() => {
      if (code === '000000') {
        setVerifying(false)
        setError('That code is incorrect. Please try again.')
        setDigits(Array(OTP_LEN).fill(''))
        inputs.current[0]?.focus()
        return
      }
      navigate(next, { replace: true })
    }, 800)
  }

  const resend = () => {
    if (seconds > 0) return
    setSeconds(RESEND_SECONDS)
    setDigits(Array(OTP_LEN).fill(''))
    setError('')
    inputs.current[0]?.focus()
  }

  return (
    <div className="flex-1 flex flex-col bg-canvas">
      {/* Header with back */}
      <div className="relative overflow-hidden bg-teal text-white px-6 pt-12 pb-10 rounded-b-[2rem]">
        <div className="absolute -right-12 -top-14 w-44 h-44 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-[-40px] w-28 h-28 rounded-full bg-white/10" />
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="relative flex w-10 h-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="relative mt-5">
          <span className="flex w-12 h-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="3" width="12" height="18" rx="2.5" />
              <path d="M11 18h2" />
            </svg>
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight">
            Verify your number
          </h1>
          <p className="mt-1.5 text-sm text-white/80">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-white">{phone}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10 -mt-4" data-scroll>
        <form onSubmit={verify} className="rounded-3xl bg-white shadow-sm p-5">
          <label className="text-xs font-semibold text-slate">
            Enter verification code
          </label>
          <div className="mt-3 flex justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el
                }}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={OTP_LEN}
                className={`h-14 w-full rounded-xl bg-canvas text-center text-xl font-extrabold text-ink outline-none ring-1 transition ${
                  error
                    ? 'ring-rose-300'
                    : d
                      ? 'ring-teal'
                      : 'ring-neutral-200 focus:ring-2 focus:ring-teal'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 text-[11px] font-medium text-rose-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={!full || verifying}
            className="mt-5 w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 active:scale-[0.99] transition disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify & continue'}
          </button>

          <div className="mt-4 text-center text-sm">
            {seconds > 0 ? (
              <p className="text-slate">
                Resend code in{' '}
                <span className="font-bold text-ink tabular-nums">
                  0:{seconds.toString().padStart(2, '0')}
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={resend}
                className="font-bold text-teal"
              >
                Resend code
              </button>
            )}
          </div>
        </form>

        <button
          onClick={() => navigate(-1)}
          className="mt-5 w-full text-center text-sm text-slate"
        >
          Wrong number?{' '}
          <span className="font-bold text-teal">Change it</span>
        </button>
      </div>
    </div>
  )
}

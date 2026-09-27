import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  CalendarIcon,
  Card,
  CheckCircle,
  Chevron,
  Megaphone,
  Trophy,
  Upload,
  Users,
} from '../ui'

const CATEGORIES = [
  { label: 'Dance', emoji: '💃' },
  { label: 'Music', emoji: '🎤' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Writing', emoji: '✍️' },
  { label: 'Art', emoji: '🎨' },
  { label: 'Coding', emoji: '💻' },
  { label: 'Cooking', emoji: '🍳' },
  { label: 'Gaming', emoji: '🎮' },
]

const DURATIONS = ['3 days', '1 week', '2 weeks', '1 month']

type Form = {
  title: string
  category: string
  description: string
  prize: string
  entry: string
  start: string
  duration: string
  spots: string
}

const STEPS = ['Basics', 'Prize', 'Schedule', 'Review']

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {hint && <span className="text-[11px] text-slate ml-1.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputCls =
  'w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink placeholder:text-slate/70 outline-none focus:ring-2 focus:ring-teal transition'

export default function HostPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [published, setPublished] = useState(false)
  const [form, setForm] = useState<Form>({
    title: '',
    category: '',
    description: '',
    prize: '',
    entry: '',
    start: '',
    duration: '1 week',
    spots: '',
  })

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const canContinue =
    step === 0
      ? form.title.trim().length > 2 && form.category !== ''
      : step === 1
        ? form.prize.trim() !== '' && form.entry.trim() !== ''
        : step === 2
          ? form.start.trim() !== '' && form.spots.trim() !== ''
          : true

  const inr = (v: string) => {
    const n = v.replace(/[^\d]/g, '')
    return n ? `₹ ${Number(n).toLocaleString('en-IN')}` : '—'
  }

  // ---- Success screen -----------------------------------------------------
  if (published) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          <span className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal to-teal-dark text-white flex items-center justify-center shadow-lg">
            <CheckCircle />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">You're live! 🎉</h1>
            <p className="text-sm text-slate mt-1.5 leading-relaxed max-w-[280px]">
              <span className="font-semibold text-ink">
                {form.title || 'Your competition'}
              </span>{' '}
              is now open for entries. We'll notify 24k+ creators in{' '}
              {form.category || 'your category'}.
            </p>
          </div>
          <Card className="w-full text-left p-4 mt-2">
            <div className="flex items-center justify-around text-center">
              <div>
                <p className="text-teal font-extrabold text-lg leading-none">
                  {inr(form.prize)}
                </p>
                <p className="text-[11px] text-slate mt-1">Prize pool</p>
              </div>
              <div className="border-l border-neutral-100 pl-6">
                <p className="text-ink font-extrabold text-lg leading-none">
                  {form.spots || '0'}
                </p>
                <p className="text-[11px] text-slate mt-1">Spots</p>
              </div>
              <div className="border-l border-neutral-100 pl-6">
                <p className="text-ink font-extrabold text-lg leading-none">
                  {form.duration}
                </p>
                <p className="text-[11px] text-slate mt-1">Runs for</p>
              </div>
            </div>
          </Card>
          <div className="w-full space-y-2.5 mt-2">
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 shadow-sm active:scale-[0.99] transition"
            >
              Go to dashboard
            </button>
            <button
              onClick={() => {
                setPublished(false)
                setStep(0)
                setForm({
                  title: '',
                  category: '',
                  description: '',
                  prize: '',
                  entry: '',
                  start: '',
                  duration: '1 week',
                  spots: '',
                })
              }}
              className="w-full rounded-xl bg-white ring-1 ring-neutral-200 text-ink text-sm font-semibold py-3.5"
            >
              Host another
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <button
          onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink active:scale-95 transition"
        >
          <ArrowLeft />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-mint text-teal flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </span>
          <h1 className="font-extrabold text-ink text-lg leading-tight">
            Host a competition
          </h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  i <= step ? 'bg-teal' : 'bg-neutral-200'
                }`}
              />
              <p
                className={`mt-1.5 text-[10px] font-semibold ${
                  i <= step ? 'text-teal' : 'text-slate'
                }`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-1 space-y-4"
        data-scroll
      >
        {/* Step 1 — Basics */}
        {step === 0 && (
          <>
            <Card className="p-4 space-y-4">
              <Field label="Competition title">
                <input
                  className={inputCls}
                  placeholder="e.g. Monsoon Poetry Slam"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <div>
                <span className="text-xs font-semibold text-ink">Category</span>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => {
                    const active = form.category === c.label
                    return (
                      <button
                        key={c.label}
                        onClick={() => set('category', c.label)}
                        className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-teal text-white shadow-sm'
                            : 'bg-white ring-1 ring-neutral-200 text-ink'
                        }`}
                      >
                        <span className="text-lg leading-none">{c.emoji}</span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Field label="Description" hint="optional">
                <textarea
                  className={`${inputCls} resize-none h-24`}
                  placeholder="Tell creators what this competition is about, rules, judging criteria…"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
            </Card>

            <button className="w-full flex items-center gap-3 rounded-2xl bg-white ring-1 ring-dashed ring-neutral-300 p-4 text-left">
              <span className="w-11 h-11 rounded-xl bg-mint text-teal flex items-center justify-center shrink-0">
                <Upload />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-sm">Add a cover image</p>
                <p className="text-xs text-slate">
                  A great banner boosts entries by 3×
                </p>
              </div>
              <Chevron className="-rotate-90 w-4 h-4 text-slate" />
            </button>
          </>
        )}

        {/* Step 2 — Prize & entry */}
        {step === 1 && (
          <>
            <Card className="p-4 space-y-4">
              <Field label="Prize pool" hint="what winners share">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="₹ 5,000"
                  value={form.prize}
                  onChange={(e) => set('prize', e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                {['2500', '5000', '10000', '25000'].map((p) => (
                  <button
                    key={p}
                    onClick={() => set('prize', p)}
                    className="flex-1 rounded-lg bg-mint/70 text-teal text-xs font-semibold py-2"
                  >
                    {inr(p)}
                  </button>
                ))}
              </div>
              <Field label="Entry fee" hint="per creator">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="₹ 99"
                  value={form.entry}
                  onChange={(e) => set('entry', e.target.value)}
                />
              </Field>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-teal to-teal-dark text-white">
              <div className="flex items-center gap-2 text-white/90">
                <Trophy className="w-4 h-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Estimated reach
                </p>
              </div>
              <p className="mt-2 text-2xl font-extrabold">2,400–6,800 entries</p>
              <p className="text-xs text-white/80 mt-1">
                Based on prize pool & category demand across 24k+ creators.
              </p>
            </Card>
          </>
        )}

        {/* Step 3 — Schedule & spots */}
        {step === 2 && (
          <Card className="p-4 space-y-4">
            <Field label="Start date">
              <div className="relative">
                <input
                  type="date"
                  className={inputCls}
                  value={form.start}
                  onChange={(e) => set('start', e.target.value)}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate">
                  <CalendarIcon />
                </span>
              </div>
            </Field>
            <div>
              <span className="text-xs font-semibold text-ink">Duration</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => {
                  const active = form.duration === d
                  return (
                    <button
                      key={d}
                      onClick={() => set('duration', d)}
                      className={`rounded-xl py-2.5 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-teal text-white shadow-sm'
                          : 'bg-white ring-1 ring-neutral-200 text-ink'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
            <Field label="Max spots" hint="how many can join">
              <div className="relative">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="200"
                  value={form.spots}
                  onChange={(e) => set('spots', e.target.value)}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate">
                  <Users />
                </span>
              </div>
            </Field>
          </Card>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <span className="w-14 h-14 rounded-2xl bg-mint text-teal flex items-center justify-center text-2xl shrink-0">
                  {CATEGORIES.find((c) => c.label === form.category)?.emoji ??
                    '🏆'}
                </span>
                <div className="min-w-0">
                  <p className="font-extrabold text-ink leading-tight">
                    {form.title || 'Untitled competition'}
                  </p>
                  <p className="text-xs text-slate mt-0.5">
                    {form.category || 'No category'} · hosted by you
                  </p>
                </div>
              </div>
              {form.description && (
                <p className="text-xs text-slate mt-3 leading-relaxed">
                  {form.description}
                </p>
              )}
            </Card>

            <Card className="p-0 overflow-hidden divide-y divide-neutral-100">
              {[
                ['Prize pool', inr(form.prize)],
                ['Entry fee', inr(form.entry)],
                ['Starts', form.start || '—'],
                ['Duration', form.duration],
                ['Max spots', form.spots || '—'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-xs text-slate">{k}</span>
                  <span className="text-sm font-bold text-ink">{v}</span>
                </div>
              ))}
            </Card>

            <p className="text-[11px] text-slate text-center px-6 leading-relaxed">
              By publishing you agree to Feedants' host guidelines. You can edit
              details until the first entry arrives.
            </p>
          </>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-canvas/80 backdrop-blur-md border-t border-neutral-200/70 px-4 pt-3 pb-5">
        <button
          disabled={!canContinue}
          onClick={() =>
            step < STEPS.length - 1
              ? setStep((s) => s + 1)
              : setPublished(true)
          }
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition active:scale-[0.99] ${
            canContinue
              ? 'bg-teal text-white shadow-sm'
              : 'bg-neutral-200 text-slate cursor-not-allowed'
          }`}
        >
          {step < STEPS.length - 1 ? 'Continue' : 'Publish competition'}
        </button>
      </div>
    </>
  )
}

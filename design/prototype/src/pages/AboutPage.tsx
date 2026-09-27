import { useNavigate } from 'react-router'
import {
  Chevron,
  Mail,
  PageHeader,
  Star,
  Trophy,
  Users,
} from '../ui'

const stats = [
  { value: '120K+', label: 'Creators' },
  { value: '4.8K', label: 'Competitions' },
  { value: '₹2.4Cr', label: 'Prizes won' },
]

const values = [
  {
    icon: <Trophy className="w-5 h-5" />,
    tint: 'bg-mint text-teal',
    title: 'Talent first',
    body: 'Fair, transparent judging that puts the spotlight on real skill — not follower counts.',
  },
  {
    icon: <Users />,
    tint: 'bg-indigo-50 text-indigo-400',
    title: 'Built for community',
    body: 'A supportive home where creators cheer each other on and grow with every entry.',
  },
  {
    icon: <Star className="w-5 h-5" />,
    tint: 'bg-amber-50 text-amber-500',
    title: 'Rewarding creativity',
    body: 'Real prizes, real payouts, and real recognition for the work you pour your heart into.',
  },
]

const links = [
  { label: 'Terms & Conditions', to: '/legal/terms' },
  { label: 'Privacy Policy', to: '/legal/privacy' },
  { label: 'Help & Support', to: '/help' },
]

export default function AboutPage() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="About" subtitle="Feedants" />

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-16 space-y-6"
        data-scroll
      >
        {/* Brand hero */}
        <div className="relative overflow-hidden rounded-2xl bg-teal text-white p-6 shadow-sm text-center">
          <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -left-8 bottom-[-32px] w-24 h-24 rounded-full bg-white/10" />
          <div className="relative">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-2xl bg-white text-teal text-3xl font-extrabold">
              F
            </span>
            <h2 className="mt-3 text-2xl font-extrabold">Feedants</h2>
            <p className="mt-1 text-sm text-white/85 leading-snug px-2">
              The competition platform where India’s creators compete, get
              discovered, and win.
            </p>
            <p className="mt-3 text-[11px] text-white/70">Version 1.0.0 · Build 128</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white shadow-sm py-4 text-center"
            >
              <p className="text-lg font-extrabold text-ink leading-none">
                {s.value}
              </p>
              <p className="text-[11px] text-slate mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
            Our mission
          </h2>
          <div className="rounded-2xl bg-white shadow-sm p-4">
            <p className="text-sm text-slate leading-relaxed">
              Feedants was born from a simple idea: every creator deserves a fair
              stage. Whether you dance, sing, write, design, or shoot, we turn
              your passion into competitions worth winning — with transparent
              judging, real prizes, and a community that has your back.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
            What we stand for
          </h2>
          <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
            {values.map((v) => (
              <div key={v.title} className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${v.tint}`}
                >
                  {v.icon}
                </span>
                <div>
                  <p className="font-bold text-ink text-sm leading-tight">
                    {v.title}
                  </p>
                  <p className="text-xs text-slate mt-0.5 leading-relaxed">
                    {v.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
            Legal & support
          </h2>
          <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
            {links.map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                className="flex items-center justify-between w-full px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl active:bg-neutral-50 transition"
              >
                <span className="text-sm font-bold text-ink">{l.label}</span>
                <Chevron className="-rotate-90 w-4 h-4 text-slate" />
              </button>
            ))}
          </div>
        </section>

        {/* Contact */}
        <a
          href="mailto:hello@feedants.com"
          className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4 active:scale-[0.99] transition"
        >
          <span className="w-10 h-10 rounded-xl bg-mint text-teal flex items-center justify-center shrink-0">
            <Mail />
          </span>
          <div>
            <p className="font-bold text-ink text-sm">Get in touch</p>
            <p className="text-xs text-slate mt-0.5">hello@feedants.com</p>
          </div>
        </a>

        <p className="text-center text-[11px] text-slate">
          © 2026 Feedants · Made in India 🇮🇳
        </p>
      </div>
    </>
  )
}

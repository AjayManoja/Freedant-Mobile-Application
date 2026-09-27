import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  Home,
  SearchIcon,
  Trophy,
  Plus,
  Megaphone,
  Upload,
  Chevron,
  userImg,
} from '../ui'

function NavItem({
  icon,
  label,
  to,
  active,
}: {
  icon: ReactNode
  label: string
  to: string
  active: boolean
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-1 text-[11px] ${
        active ? 'text-teal font-semibold' : 'text-slate'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// The central "+" opens a quick-create sheet linking the two primary flows —
// hosting a new competition and browsing competitions to join.
function CreateSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()

  const actions = [
    {
      label: 'Host a competition',
      sub: 'Set a prize, invite creators, judge entries',
      icon: <Megaphone className="w-5 h-5" />,
      tint: 'bg-mint text-teal',
      to: '/host',
    },
    {
      label: 'Join a competition',
      sub: 'Browse live contests and submit your entry',
      icon: <SearchIcon className="w-5 h-5" />,
      tint: 'bg-indigo-50 text-indigo-500',
      to: '/explore',
    },
    {
      label: 'My submissions',
      sub: 'Track drafts, entries and results',
      icon: <Upload />,
      tint: 'bg-amber-50 text-amber-600',
      to: '/submissions',
    },
  ]

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center transition ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <h3 className="mt-4 text-lg font-extrabold text-ink">Create</h3>
        <p className="text-xs text-slate">What would you like to do?</p>

        <div className="mt-4 space-y-2.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                onClose()
                navigate(a.to)
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-white p-3.5 text-left shadow-sm active:scale-[0.99] transition"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.tint}`}
              >
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink leading-tight">
                  {a.label}
                </p>
                <p className="text-xs text-slate leading-snug">{a.sub}</p>
              </div>
              <span className="text-slate shrink-0">
                <Chevron className="-rotate-90 w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BottomNav() {
  const { pathname } = useLocation()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[430px] bg-white border-t border-neutral-100 flex items-end justify-between px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <NavItem icon={<Home />} label="Home" to="/" active={pathname === '/'} />
        <NavItem
          icon={<SearchIcon />}
          label="Explore"
          to="/explore"
          active={pathname.startsWith('/explore')}
        />
        <div className="-mt-6">
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="Create"
            className="w-12 h-12 rounded-full bg-teal text-white flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            <Plus />
          </button>
        </div>
        <NavItem
          icon={<Trophy className="w-5 h-5" />}
          label="Competitions"
          to="/competitions"
          active={pathname.startsWith('/competitions')}
        />
        <NavItem
          icon={
            <img
              src={userImg}
              alt="Profile"
              className="w-6 h-6 rounded-full object-cover"
            />
          }
          label="Profile"
          to="/profile"
          active={pathname === '/profile'}
        />
      </div>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Fire,
  Megaphone,
  Trophy,
  Users,
} from '../ui'
import type { ReactNode } from 'react'

type Note = {
  id: number
  icon: ReactNode
  tint: string
  title: string
  body: string
  time: string
  unread: boolean
}

const today: Note[] = [
  {
    id: 1,
    icon: <Trophy className="w-5 h-5" />,
    tint: 'bg-amber-50 text-amber-500',
    title: 'Results are out!',
    body: 'Feedants Classical Dance winners have been announced. Check your rank.',
    time: '12m ago',
    unread: true,
  },
  {
    id: 2,
    icon: <Fire className="w-5 h-5" />,
    tint: 'bg-mint text-teal',
    title: 'Registration closing soon',
    body: 'Only 5 spots left in React UI Challenge. Grab yours before it ends.',
    time: '1h ago',
    unread: true,
  },
  {
    id: 3,
    icon: <Megaphone className="w-5 h-5" />,
    tint: 'bg-indigo-50 text-indigo-400',
    title: 'You earned ₹ 10',
    body: 'Riya joined using your referral link. Keep sharing to earn more.',
    time: '3h ago',
    unread: false,
  },
]

const earlier: Note[] = [
  {
    id: 4,
    icon: <CheckCircle />,
    tint: 'bg-mint text-teal',
    title: 'Submission received',
    body: 'Your entry for Acoustic Cover Battle was uploaded successfully.',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: 5,
    icon: <Users />,
    tint: 'bg-rose-50 text-rose-400',
    title: 'New competition in Dance',
    body: 'Bollywood Freestyle is now open for registration. ₹ 2,800 prize pool.',
    time: '2 days ago',
    unread: false,
  },
  {
    id: 6,
    icon: <Clock />,
    tint: 'bg-neutral-100 text-slate',
    title: 'Reminder',
    body: 'Monsoon Poetry Slam ends in 5 hours. Finish your submission.',
    time: '2 days ago',
    unread: false,
  },
]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState({ today, earlier })
  const unreadCount = notes.today
    .concat(notes.earlier)
    .filter((n) => n.unread).length

  const markAllRead = () =>
    setNotes((prev) => ({
      today: prev.today.map((n) => ({ ...n, unread: false })),
      earlier: prev.earlier.map((n) => ({ ...n, unread: false })),
    }))

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink font-bold text-lg"
        >
          <ArrowLeft />
          Notifications
        </button>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-teal text-xs font-semibold"
          >
            Mark all read
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <p className="px-5 pb-1 text-xs text-slate">
          You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
        </p>
      )}

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 pt-2 space-y-5"
        data-scroll
      >
        <Group label="Today" notes={notes.today} />
        <Group label="Earlier" notes={notes.earlier} />
      </div>

      <BottomNav />
    </>
  )
}

function Group({ label, notes }: { label: string; notes: Note[] }) {
  return (
    <section>
      <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2 px-1">
        {label}
      </h2>
      <div className="space-y-2">
        {notes.map((n) => (
          <div
            key={n.id}
            className={`relative flex gap-3 rounded-2xl p-4 shadow-sm ${
              n.unread ? 'bg-white ring-1 ring-teal/15' : 'bg-white'
            }`}
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.tint}`}
            >
              {n.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-ink text-sm leading-tight flex items-center gap-1.5">
                  {n.unread && (
                    <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
                  )}
                  {n.title}
                </p>
                <span className="text-[10px] text-slate shrink-0 mt-0.5">
                  {n.time}
                </span>
              </div>
              <p className="text-xs text-slate mt-1 leading-relaxed">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

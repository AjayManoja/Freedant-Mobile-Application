import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import judge from './assets/avatars/judge.jpg'
import neha from './assets/avatars/neha.jpg'

export const judgeImg = judge
// The signed-in user (Neha Sharma) — used consistently in the app header,
// the bottom-nav profile tab, and the Profile page identity card.
export const userImg = neha

/* ---------- layout helpers ---------- */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-neutral-100 text-slate text-xs font-medium px-2.5 py-1">
      {children}
    </span>
  )
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-ink">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-teal text-xs font-semibold flex items-center gap-0.5"
        >
          {action}
          <Chevron className="-rotate-90 w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// Sticky back-header shared by the secondary/detail pages (Help, legal, etc.).
export function PageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md px-4 pt-4 pb-3 flex items-center gap-3">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink active:scale-95 transition"
      >
        <ArrowLeft />
      </button>
      <div className="min-w-0">
        {subtitle && <p className="text-slate text-xs truncate">{subtitle}</p>}
        <h1 className="text-2xl font-extrabold text-ink leading-tight truncate">
          {title}
        </h1>
      </div>
    </div>
  )
}

/* ---------- icons ---------- */

const s = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
}

export function ArrowLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...s}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}
export function CheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  )
}
export function Trophy({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <path d="M6 4h12v4a6 6 0 01-12 0V4zM6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3M9 20h6M12 14v6" />
    </svg>
  )
}
export function Users() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M18 20a6 6 0 00-3-5" />
    </svg>
  )
}
export function Play() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
export function PlayBadge() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="rgba(13,128,116,0.85)" />
      <path d="M10 8v8l6-4z" fill="white" />
    </svg>
  )
}
export function Hourglass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
      <path d="M6 3h12M6 21h12M7 3c0 4 10 5 10 9s-10 5-10 9M17 3c0 4-10 5-10 9" />
    </svg>
  )
}
export function Clock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
export function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}
export function Send() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}
export function Upload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 15V3M7 8l5-5 5 5" />
    </svg>
  )
}
export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className={className} {...s}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
export function Info() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}
export function Shield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}
export function Megaphone({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-teal`} {...s}>
      <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8M17 5a8 8 0 010 14" />
    </svg>
  )
}
export function Chat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  )
}
export function Home() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...s}>
      <path d="M3 11l9-8 9 8M5 10v10h14V10" />
    </svg>
  )
}
export function Camera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M3 8h4l2-2h6l2 2h4v11H3V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
export function Mail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
export function Phone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 011-2z" />
    </svg>
  )
}
export function SearchIcon({ className = 'w-[22px] h-[22px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  )
}
export function Plus() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...s}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
export function Fire({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <path d="M12 3c1 3-2 4-2 7a2 2 0 004 0c0-1 0-1.5.5-2 1 2 2.5 3 2.5 5.5a5 5 0 01-10 0C7 12 10 9 12 3z" />
    </svg>
  )
}
export function Star({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6L12 16.9 6.6 19.3l1.3-6-4.5-4 6-.6z" />
    </svg>
  )
}
export function Bell({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  )
}

export function Globe({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9S9.5 5.5 12 3z" />
    </svg>
  )
}
export function Lock({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
      <path d="M12 15v2" />
    </svg>
  )
}
export function Moon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />
    </svg>
  )
}
export function Trash({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...s}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" />
    </svg>
  )
}

export function Razorpay() {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      <svg width="11" height="12" viewBox="0 0 24 26" aria-hidden="true">
        <path d="M14.5 0L7 14h4l-3.5 12L20 8h-5l3-8z" fill="#3395ff" />
      </svg>
      <span className="font-bold text-[#072654] text-[11px]">Razorpay</span>
    </span>
  )
}

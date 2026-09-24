import { NavLink } from 'react-router-dom'
import { MOBILE_NAV } from './nav'
import { MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useApp } from '@/state/store'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { NAV_ITEMS } from './nav'

export function BottomNav() {
  const openRecord = useApp((s) => s.openRecord)
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* Floating record button */}
      <button
        onClick={() => openRecord('menu')}
        className="fixed bottom-[72px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-glow transition active:scale-95 lg:hidden"
        style={{ bottom: 'calc(72px + var(--safe-bottom))' }}
        aria-label="Record"
      >
        <Plus className="h-6 w-6" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/50 bg-white/70 pb-safe backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
                isActive ? 'text-brand-600' : 'text-ink-400',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-400"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <div className="grid grid-cols-3 gap-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50/50 px-3 py-4 text-center text-xs font-medium text-ink-700 hover:bg-ink-100"
            >
              <item.icon className="h-5 w-5 text-brand-600" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </Modal>
    </>
  )
}

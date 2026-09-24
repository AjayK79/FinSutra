import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav'
import { cn } from '@/lib/cn'
import { useCompany } from '@/state/hooks'
import { Avatar } from '@/components/ui/primitives'

export function Sidebar() {
  const company = useCompany()
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/60 bg-white/60 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-glow-sm">
          <Logo />
        </div>
        <div>
          <div className="gradient-text text-[16px] font-extrabold leading-none">FinSutra</div>
          <div className="mt-0.5 text-[11px] text-ink-400">Money, understood</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-3">
        <NavLink to="/settings" className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50">
          <Avatar name={company?.owner_name ?? 'FinSutra'} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-800">{company?.owner_name ?? 'Owner'}</div>
            <div className="truncate text-xs text-ink-400">{company?.name ?? 'Your business'}</div>
          </div>
        </NavLink>
      </div>
    </aside>
  )
}

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
      <path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" />
      <path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" />
    </svg>
  )
}

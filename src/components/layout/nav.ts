import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Wallet,
  Receipt,
  Users,
  Truck,
  BarChart3,
  Sparkles,
  FolderOpen,
  Settings,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
  { label: 'Events', to: '/events', icon: PartyPopper },
  { label: 'Invoices', to: '/invoices', icon: FileText },
  { label: 'Receivables', to: '/receivables', icon: Wallet },
  { label: 'Payables', to: '/payables', icon: Receipt },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Vendors', to: '/vendors', icon: Truck },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'AI CFO', to: '/ai-cfo', icon: Sparkles },
  { label: 'Documents', to: '/documents', icon: FolderOpen },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export const MOBILE_NAV = [
  { label: 'Home', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Ledger', to: '/transactions', icon: ArrowLeftRight },
  { label: 'Invoices', to: '/invoices', icon: FileText },
  { label: 'AI CFO', to: '/ai-cfo', icon: Sparkles },
]

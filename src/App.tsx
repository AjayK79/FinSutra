import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { activeCompanyId } from '@/db/repo'
import { useApp } from '@/state/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RecordModal } from '@/components/RecordModal'
import { GlobalSearch } from '@/components/GlobalSearch'
import { InstallPrompt } from '@/components/InstallPrompt'
import { ToastHost } from '@/components/ToastHost'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { generateAlerts } from '@/lib/alerts'
import { useGoogleAuth } from '@/state/useGoogleAuth'

import { Login } from '@/pages/Login'
import { Onboarding } from '@/pages/Onboarding'
import { Dashboard } from '@/pages/Dashboard'
import { Transactions } from '@/pages/Transactions'
import { Invoices } from '@/pages/Invoices'
import { CreateInvoice } from '@/pages/CreateInvoice'
import { InvoiceDetail } from '@/pages/InvoiceDetail'
import { Receivables } from '@/pages/Receivables'
import { Payables } from '@/pages/Payables'
import { Customers } from '@/pages/Customers'
import { CustomerDetail } from '@/pages/CustomerDetail'
import { Vendors } from '@/pages/Vendors'
import { VendorDetail } from '@/pages/VendorDetail'
import { Reports } from '@/pages/Reports'
import { AICFO } from '@/pages/AICFO'
import { Documents } from '@/pages/Documents'
import { Settings } from '@/pages/Settings'

function AppShell() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="app-bg flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5 pb-28 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <RecordModal />
      <GlobalSearch />
      <InstallPrompt />
    </div>
  )
}

function Protected() {
  const hasCompany = useLiveQuery(async () => {
    const id = activeCompanyId()
    if (id && (await db.companies.get(id))) return true
    return (await db.companies.count()) > 0
  }, [])

  // Generate alerts once data is available
  useEffect(() => {
    if (hasCompany) generateAlerts()
  }, [hasCompany])

  if (hasCompany === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    )
  }
  if (!hasCompany) return <Navigate to="/onboarding" replace />
  return <AppShell />
}

export default function App() {
  const setOnline = useApp((s) => s.setOnline)
  const { configured, signedIn } = useGoogleAuth()

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [setOnline])

  // Login gate: once a Google Client ID is configured, require an allowlisted
  // sign-in before the app is usable. Until then (no Client ID) the app runs
  // as before, so nothing breaks pre-setup.
  if (configured && !signedIn) {
    return (
      <>
        <Login />
        <ToastHost />
      </>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Protected />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<CreateInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/invoices/:id/edit" element={<CreateInvoice />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/payables" element={<Payables />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/ai-cfo" element={<AICFO />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      <ToastHost />
      <ConfirmDialog />
    </>
  )
}

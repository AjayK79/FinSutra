import { useSyncExternalStore } from 'react'
import { GoogleAuth } from '@/services/google/auth'

// Subscribe React to GoogleAuth session changes.
function subscribe(cb: () => void) {
  return GoogleAuth.subscribe(cb)
}

export function useGoogleAuth() {
  const email = useSyncExternalStore(subscribe, () => GoogleAuth.currentEmail())
  return {
    email,
    signedIn: !!email,
    configured: GoogleAuth.isConfigured(),
    signIn: () => GoogleAuth.signIn(),
    signOut: () => GoogleAuth.signOut(),
  }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setSessionExpiredHandler, tokenStore } from '../api/client'
import { authApi } from '../api/endpoints'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  /** True while the stored token is being checked on startup. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  canManageCompanies: boolean
  canEditSlips: boolean
  canRegisterPayment: boolean
  /** Financial has no access to the installment plans at all. */
  canManageInstallmentPlans: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(logout)
    return () => setSessionExpiredHandler(null)
  }, [logout])

  useEffect(() => {
    if (tokenStore.get() === null) return
    authApi
      .me()
      .then(setUser, () => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    tokenStore.set(result.token)
    setUser(result.user)
  }, [])

  const value = useMemo<AuthState>(() => {
    const role = user?.role
    return {
      user,
      loading,
      login,
      logout,
      // Mirrors the server rules; the server remains the one that enforces them.
      isAdmin: role === 'ADMIN',
      canManageCompanies: role === 'ADMIN' || role === 'FISCAL',
      canEditSlips: role === 'ADMIN' || role === 'FISCAL' || role === 'ACCOUNTING',
      canRegisterPayment: role === 'ADMIN' || role === 'FINANCIAL' || role === 'ACCOUNTING',
      canManageInstallmentPlans: role === 'ADMIN' || role === 'FISCAL' || role === 'ACCOUNTING',
    }
  }, [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

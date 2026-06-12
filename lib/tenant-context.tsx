'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'
import { getPlanFlags, type PlanKey } from '@/lib/permissions'

interface Tenant {
  id: string
  slug: string
  nome: string
  email: string
  telefone: string
  plano: 'basic' | 'pro' | 'premium'
  status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'trial_expired' | 'blocked'
  trial_ends_at: string | null
  trial_start?: string | null
  trial_end?: string | null
  subscription_status?: 'trialing' | 'pending' | 'active' | 'overdue' | 'trial_expired' | 'blocked' | 'cancelled' | null
}

interface TenantContextType {
  tenant: Tenant | null
  loading: boolean
  isTrialing: boolean
  trialDaysLeft: number
  hasAccess: boolean
  accessReason: string
  currentPlan: PlanKey
  isBasic: boolean
  isPro: boolean
  isPremium: boolean
  isProOrPremium: boolean
  refreshTenant: (options?: RefreshTenantOptions) => Promise<void>
}

interface AccessState {
  allowed: boolean
  reason: string
  daysLeft: number
}

interface RefreshTenantOptions {
  force?: boolean
  silent?: boolean
}

interface CachedTenantAccess {
  tenant: Tenant
  access: AccessState
  expiresAt: number
}

const ACCESS_CACHE_TTL = 2 * 60 * 1000
const ACCESS_REVALIDATE_INTERVAL = 5 * 60 * 1000
const accessCache = new Map<string, CachedTenantAccess>()
const accessRequests = new Map<string, Promise<CachedTenantAccess>>()

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  isTrialing: false,
  trialDaysLeft: 0,
  hasAccess: false,
  accessReason: 'loading',
  currentPlan: 'basic',
  isBasic: true,
  isPro: false,
  isPremium: false,
  isProOrPremium: false,
  refreshTenant: async () => {},
})

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessState, setAccessState] = useState<AccessState>({
    allowed: false,
    reason: 'loading',
    daysLeft: 0,
  })
  const mountedRef = useRef(true)

  const fetchTenant = useCallback(async (options: RefreshTenantOptions = {}) => {
    const { force = false, silent = false } = options
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    const token = session?.access_token

    if (!token) {
      if (mountedRef.current) {
        setTenant(null)
        setAccessState({ allowed: false, reason: 'unauthenticated', daysLeft: 0 })
        setLoading(false)
      }
      return
    }

    const cacheKey = `${session.user.id}:${slug}`
    const cached = accessCache.get(cacheKey)

    if (!force && cached && cached.expiresAt > Date.now()) {
      if (mountedRef.current) {
        setTenant(cached.tenant)
        setAccessState(cached.access)
        setLoading(false)
      }
      return
    }

    if (!silent) setLoading(true)

    let request = accessRequests.get(cacheKey)

    if (!request) {
      request = (async () => {
        const response = await fetch(`/api/tenant/access?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          const error = new Error(result.error || response.statusText) as Error & {
            status?: number
          }
          error.status = response.status
          throw error
        }

        const nextTenant = result.tenant as Tenant
        const nextAccess = result.access ?? getTenantAccess(nextTenant)
        const entry = {
          tenant: nextTenant,
          access: nextAccess,
          expiresAt: Date.now() + ACCESS_CACHE_TTL,
        }
        accessCache.set(cacheKey, entry)
        return entry
      })().finally(() => {
        accessRequests.delete(cacheKey)
      })
      accessRequests.set(cacheKey, request)
    }

    try {
      const result = await request
      if (mountedRef.current) {
        setTenant(result.tenant)
        setAccessState(result.access)
      }
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      console.error('TenantContext error:', error)

      // Authentication/authorization failures are definitive. Transient server or
      // network failures keep the current screen visible until the next revalidation.
      if (mountedRef.current && [401, 403, 404].includes(status ?? 0)) {
        setTenant(null)
        setAccessState({ allowed: false, reason: 'forbidden', daysLeft: 0 })
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    mountedRef.current = true

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void fetchTenant({ force: true, silent: true })
      }
    }

    void fetchTenant()
    window.addEventListener('pageshow', handlePageShow)
    const interval = window.setInterval(
      () => void fetchTenant({ force: true, silent: true }),
      ACCESS_REVALIDATE_INTERVAL,
    )

    return () => {
      mountedRef.current = false
      window.removeEventListener('pageshow', handlePageShow)
      window.clearInterval(interval)
    }
  }, [fetchTenant])

  const plan = getPlanFlags(tenant?.plano)
  const isTrialing = accessState.allowed && accessState.reason === 'trial'
  const refreshTenant = useCallback(
    (options?: RefreshTenantOptions) => fetchTenant(options),
    [fetchTenant],
  )

  return (
    <TenantContext.Provider
      value={{
        tenant,
        loading,
        isTrialing,
        trialDaysLeft: accessState.daysLeft,
        hasAccess: accessState.allowed,
        accessReason: accessState.reason,
        refreshTenant,
        ...plan,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}

'use client'

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
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
  subscription_status?: 'trialing' | 'active' | 'trial_expired' | 'blocked' | 'cancelled' | null
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
  refreshTenant: () => Promise<void>
}

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

  const fetchTenant = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setTenant(null)
      setLoading(false)
      return
    }

    const response = await fetch(`/api/tenant/access?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('TenantContext error:', result.error || response.statusText)
      setTenant(null)
    } else {
      setTenant(result.tenant ?? null)
    }

    setLoading(false)
  }, [slug])

  useEffect(() => {
    let active = true

    const refresh = async (showLoading = true) => {
      if (!active) return
      await fetchTenant(showLoading)
    }
    const handlePageHide = () => setLoading(true)
    const handlePageShow = () => refresh(true)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh(true)
    }

    refresh(true)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('focus', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(() => refresh(false), 30000)

    return () => {
      active = false
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('focus', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
    }
  }, [fetchTenant])

  const access = getTenantAccess(tenant)
  const plan = getPlanFlags(tenant?.plano)
  const isTrialing =
    (tenant?.subscription_status === 'trialing' || tenant?.status === 'trial') &&
    access.allowed

  return (
    <TenantContext.Provider
      value={{
        tenant,
        loading,
        isTrialing,
        trialDaysLeft: access.daysLeft,
        hasAccess: access.allowed,
        accessReason: access.reason,
        refreshTenant: () => fetchTenant(true),
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

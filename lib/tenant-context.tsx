'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

interface Tenant {
  id: string
  slug: string
  nome: string
  email: string
  telefone: string
  plano: 'basic' | 'pro' | 'premium'
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  trial_ends_at: string
}

interface TenantContextType {
  tenant: Tenant | null
  loading: boolean
  isTrialing: boolean
  trialDaysLeft: number
  hasAccess: boolean
  accessReason: string
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  isTrialing: false,
  trialDaysLeft: 0,
  hasAccess: false,
  accessReason: 'loading',
})

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTenant() {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .maybeSingle() // ✅ CORRIGIDO: era .single() — lança 406 se não achar nada

      if (error) console.error('TenantContext error:', error)
      setTenant(data ?? null)
      setLoading(false)
    }
    fetchTenant()
  }, [slug])

  const access = getTenantAccess(tenant)
  const isTrialing = tenant?.status === 'trial' && access.allowed
  const trialDaysLeft = access.daysLeft

  return (
    <TenantContext.Provider value={{ tenant, loading, isTrialing, trialDaysLeft, hasAccess: access.allowed, accessReason: access.reason }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useTenantId() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
      .then(({ data }) => { if (data) setTenantId(data.id) })
  }, [slug])

  return tenantId
}
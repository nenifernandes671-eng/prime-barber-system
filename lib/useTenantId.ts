'use client'

import { useTenant } from '@/lib/tenant-context'

export function useTenantId() {
  const { tenant } = useTenant()
  return tenant?.id ?? null
}

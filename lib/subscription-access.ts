export interface TenantAccessInput {
  status?: string | null
  trial_ends_at?: string | null
}

export function getTenantAccess(tenant?: TenantAccessInput | null) {
  if (!tenant) {
    return {
      allowed: false,
      reason: 'not-found' as const,
      daysLeft: 0,
    }
  }

  const now = Date.now()
  const endMs = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : null
  const daysLeft = endMs ? Math.max(0, Math.ceil((endMs - now) / 86400000)) : 0

  if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
    return {
      allowed: false,
      reason: tenant.status,
      daysLeft: 0,
    }
  }

  if ((tenant.status === 'trial' || tenant.status === 'active') && endMs && endMs <= now) {
    return {
      allowed: false,
      reason: tenant.status === 'trial' ? 'trial-expired' as const : 'subscription-expired' as const,
      daysLeft: 0,
    }
  }

  return {
    allowed: tenant.status === 'trial' || tenant.status === 'active',
    reason: 'ok' as const,
    daysLeft,
  }
}

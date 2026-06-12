export interface TenantAccessInput {
  status?: string | null
  trial_ends_at?: string | null
  trial_start?: string | null
  trial_end?: string | null
  subscription_status?: string | null
}

export function getTenantAccess(tenant?: TenantAccessInput | null) {
  if (!tenant) {
    return {
      allowed: false,
      reason: 'not-found' as const,
      daysLeft: 0,
    }
  }

  const normalizedStatus = String(tenant.subscription_status || tenant.status || '').toLowerCase()
  const isTrial = normalizedStatus === 'trialing' || normalizedStatus === 'trial'
  const isActive = normalizedStatus === 'active'
  const accessEnd = tenant.trial_ends_at || tenant.trial_end
  const now = Date.now()
  const endMs = accessEnd ? new Date(accessEnd).getTime() : null
  const daysLeft = endMs ? Math.max(0, Math.ceil((endMs - now) / 86400000)) : 0

  if (
    ['cancelled', 'suspended', 'blocked', 'trial_expired'].includes(normalizedStatus) ||
    tenant.status === 'cancelled' ||
    tenant.status === 'suspended'
  ) {
    return {
      allowed: false,
      reason: normalizedStatus || tenant.status || 'blocked',
      daysLeft: 0,
    }
  }

  if (tenant.subscription_status === 'active') {
    return {
      allowed: true,
      reason: 'ok' as const,
      daysLeft,
    }
  }

  if ((isTrial || isActive) && endMs && endMs <= now) {
    return {
      allowed: false,
      reason: isTrial ? 'trial-expired' as const : 'subscription-expired' as const,
      daysLeft: 0,
    }
  }

  return {
    allowed: isTrial || isActive,
    reason: 'ok' as const,
    daysLeft,
  }
}

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

  const subscriptionStatus = String(tenant.subscription_status || '').toLowerCase()
  const accessEnd = tenant.trial_ends_at || tenant.trial_end
  const now = Date.now()
  const endMs = accessEnd ? new Date(accessEnd).getTime() : null
  const hasActiveSubscription = subscriptionStatus === 'active'
  const hasActiveTrial = Boolean(endMs && Number.isFinite(endMs) && endMs > now)
  const daysLeft = hasActiveTrial && endMs
    ? Math.max(1, Math.ceil((endMs - now) / 86400000))
    : 0

  if (hasActiveSubscription) {
    return {
      allowed: true,
      reason: 'subscription-active' as const,
      daysLeft,
    }
  }

  if (hasActiveTrial) {
    return {
      allowed: true,
      reason: 'trial' as const,
      daysLeft,
    }
  }

  return {
    allowed: false,
    reason: endMs && endMs <= now
      ? 'subscription-expired' as const
      : subscriptionStatus || tenant.status || 'inactive',
    daysLeft: 0,
  }
}

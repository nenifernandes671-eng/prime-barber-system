export interface TenantAccessInput {
  status?: string | null
  trial_ends_at?: string | null
  trial_start?: string | null
  trial_end?: string | null
  paid_until?: string | null
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
  const tenantStatus = String(tenant.status || '').toLowerCase()
  const effectiveStatus = subscriptionStatus || tenantStatus
  const trialEnd = tenant.trial_ends_at || tenant.trial_end
  const paidUntil = tenant.paid_until || (['active', 'paid'].includes(effectiveStatus) ? tenant.trial_ends_at : null)
  const now = Date.now()
  const trialEndMs = trialEnd ? new Date(trialEnd).getTime() : null
  const paidUntilMs = paidUntil ? new Date(paidUntil).getTime() : null
  const blockedStatuses = ['expired', 'blocked', 'canceled', 'cancelled', 'suspended', 'overdue', 'trial_expired']
  const isBlocked = blockedStatuses.includes(effectiveStatus) || blockedStatuses.includes(tenantStatus)
  const hasTrialStatus = ['trial', 'trialing'].includes(effectiveStatus) || tenantStatus === 'trial'
  const hasActiveTrial = Boolean(hasTrialStatus && trialEndMs && Number.isFinite(trialEndMs) && trialEndMs > now)
  const hasPaidStatus = ['active', 'paid'].includes(effectiveStatus) || ['active', 'paid'].includes(tenantStatus)
  // Active legacy tenants may not have an end date. Keep them working until paid_until is migrated.
  const hasActiveSubscription = Boolean(hasPaidStatus && (!paidUntilMs || (Number.isFinite(paidUntilMs) && paidUntilMs > now)))
  const activeEndMs = hasActiveTrial ? trialEndMs : hasActiveSubscription ? paidUntilMs : null
  const daysLeft = activeEndMs
    ? Math.max(1, Math.ceil((activeEndMs - now) / 86400000))
    : 0

  if (isBlocked) {
    return {
      allowed: false,
      reason: effectiveStatus || tenantStatus || 'blocked',
      daysLeft: 0,
    }
  }

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
    reason: hasTrialStatus && trialEndMs && trialEndMs <= now
      ? 'trial-expired' as const
      : hasPaidStatus && paidUntilMs && paidUntilMs <= now
        ? 'subscription-expired' as const
        : effectiveStatus || 'inactive',
    daysLeft: 0,
  }
}

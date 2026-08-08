export type PlanKey = 'basic' | 'pro' | 'premium'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export const BILLING_CYCLES: Record<BillingCycle, { asaasCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; months: number; multiplier: number }> = {
  monthly: { asaasCycle: 'MONTHLY', months: 1, multiplier: 1 },
  quarterly: { asaasCycle: 'QUARTERLY', months: 3, multiplier: 3 },
  yearly: { asaasCycle: 'YEARLY', months: 12, multiplier: 12 },
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  const cycle = String(value || '').trim().toLowerCase()
  return cycle === 'quarterly' || cycle === 'yearly' ? cycle : 'monthly'
}

export function planPrices() {
  return {
    basic: Number(process.env.ASAAS_PLAN_BASIC || 39),
    pro: Number(process.env.ASAAS_PLAN_PRO || 69),
    premium: Number(process.env.ASAAS_PLAN_PREMIUM || 99),
  }
}

export function subscriptionEndDate(start: Date, cycle: BillingCycle) {
  const end = new Date(start)
  end.setMonth(end.getMonth() + BILLING_CYCLES[cycle].months)
  return end
}

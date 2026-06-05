export type PlanKey = 'basic' | 'pro' | 'premium'

export const PLAN_FEATURES = {
  basic: {
    maxBarbers: 1,
    memberships: false,
    uploads: false,
    whatsapp: false,
    reports: false,
    commissions: false,
    advancedFinance: false,
    expenses: false,
    executiveDashboard: false,
    multiUnit: false,
    inactiveClients: false,
  },

  pro: {
    maxBarbers: 999,
    memberships: true,
    uploads: true,
    whatsapp: true,
    reports: true,
    commissions: true,
    advancedFinance: true,
    expenses: true,
    executiveDashboard: false,
    multiUnit: false,
    inactiveClients: false,
  },

  premium: {
    maxBarbers: 999,
    memberships: true,
    uploads: true,
    whatsapp: true,
    reports: true,
    commissions: true,
    advancedFinance: true,
    expenses: true,
    executiveDashboard: true,
    multiUnit: true,
    inactiveClients: true,
  },
} satisfies Record<PlanKey, Record<string, boolean | number>>

export const BASIC_ADMIN_PATHS = [
  '/admin',
  '/admin/agendamentos',
  '/admin/clientes',
  '/admin/barbeiros',
  '/admin/barbers',
  '/admin/servicos',
  '/admin/financeiro',
  '/admin/configuracoes',
]

export const PRO_ADMIN_PATHS = [
  '/admin/despesas',
  '/admin/relatorios',
  '/admin/comissoes',
  '/admin/whatsapp',
  '/admin/memberships',
]

export const PREMIUM_ADMIN_PATHS = [
  '/admin/dashboard-executivo',
  '/admin/unidades',
  '/admin/clientes-inativos',
]

export function normalizePlan(plan?: string | null): PlanKey {
  const normalized = String(plan || 'basic').toLowerCase()
  if (normalized === 'premium') return 'premium'
  if (normalized === 'pro') return 'pro'
  return 'basic'
}

export function getPlanFlags(plan?: string | null) {
  const currentPlan = normalizePlan(plan)
  const isBasic = currentPlan === 'basic'
  const isPro = currentPlan === 'pro'
  const isPremium = currentPlan === 'premium'
  const isProOrPremium = isPro || isPremium

  return {
    currentPlan,
    isBasic,
    isPro,
    isPremium,
    isProOrPremium,
  }
}

export function isAdminPathAllowed(pathname: string, slug: string, plan?: string | null) {
  const relativePath = pathname.replace(new RegExp(`^/${slug}`), '') || '/admin'
  const { isPremium, isProOrPremium } = getPlanFlags(plan)

  if (PREMIUM_ADMIN_PATHS.some((path) => relativePath.startsWith(path))) {
    return isPremium
  }

  if (PRO_ADMIN_PATHS.some((path) => relativePath.startsWith(path))) {
    return isProOrPremium
  }

  return BASIC_ADMIN_PATHS.some((path) => relativePath === path)
}

export function getBlockedPlanForPath(pathname: string, slug: string) {
  const relativePath = pathname.replace(new RegExp(`^/${slug}`), '') || '/admin'

  if (PREMIUM_ADMIN_PATHS.some((path) => relativePath.startsWith(path))) return 'premium'
  if (PRO_ADMIN_PATHS.some((path) => relativePath.startsWith(path))) return 'pro'
  return null
}

export function getMaxBarbers(plan?: string) {
  return PLAN_FEATURES[
    normalizePlan(plan)
  ]?.maxBarbers ?? 1
}

export function hasFeature(
  plan: string | undefined | null,
  feature: string
) {
  return PLAN_FEATURES[
    normalizePlan(plan)
  ]?.[
    feature as keyof typeof PLAN_FEATURES.basic
  ] ?? false
}

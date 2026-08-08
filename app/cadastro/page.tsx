import { CadastroClient } from './CadastroClient'

type PlanKey = 'basic' | 'pro' | 'premium'
type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

function normalizeInitialPlan(value: string | string[] | undefined): PlanKey {
  const firstValue = Array.isArray(value) ? value[0] : value
  const normalizedValue = firstValue?.toLowerCase()
  return normalizedValue === 'basic' || normalizedValue === 'pro' || normalizedValue === 'premium'
    ? normalizedValue
    : 'basic'
}

function normalizeInitialCycle(value: string | string[] | undefined): BillingCycle {
  const firstValue = Array.isArray(value) ? value[0] : value
  const normalizedValue = firstValue?.toLowerCase()
  return normalizedValue === 'quarterly' || normalizedValue === 'yearly' ? normalizedValue : 'monthly'
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string | string[]; ciclo?: string | string[] }>
}) {
  const params = await searchParams
  return <CadastroClient initialPlan={normalizeInitialPlan(params.plano)} initialCycle={normalizeInitialCycle(params.ciclo)} />
}

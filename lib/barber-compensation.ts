export type BarberCompensationType =
  | 'commission'
  | 'fixed_salary'
  | 'salary_plus_commission'
  | 'chair_rental'

export type BarberCompensationSource = {
  compensation_type?: string | null
  commission_percentage?: number | null
  commission_percent?: number | null
  fixed_salary_amount?: number | null
  chair_rental_amount?: number | null
}

export type BarberCompensationSettings = {
  type: BarberCompensationType
  commissionPercentage: number
  fixedSalaryAmount: number
  chairRentalAmount: number
}

export const COMPENSATION_LABELS: Record<BarberCompensationType, string> = {
  commission: 'Comissão',
  fixed_salary: 'Salário fixo',
  salary_plus_commission: 'Salário + comissão',
  chair_rental: 'Aluguel de cadeira',
}

export function normalizeCompensationType(value?: string | null): BarberCompensationType {
  if (value === 'fixed_salary') return 'fixed_salary'
  if (value === 'salary_plus_commission') return 'salary_plus_commission'
  if (value === 'chair_rental') return 'chair_rental'
  return 'commission'
}

export function getBarberCompensation(
  source?: BarberCompensationSource | null,
  legacy?: BarberCompensationSource | null,
): BarberCompensationSettings {
  const type = normalizeCompensationType(source?.compensation_type ?? legacy?.compensation_type)
  const legacyPercentage =
    legacy?.commission_percentage ??
    legacy?.commission_percent ??
    0

  return {
    type,
    commissionPercentage: Number(
      source?.commission_percentage ??
      source?.commission_percent ??
      legacyPercentage ??
      0,
    ),
    fixedSalaryAmount: Number(
      source?.fixed_salary_amount ??
      legacy?.fixed_salary_amount ??
      0,
    ),
    chairRentalAmount: Number(
      source?.chair_rental_amount ??
      legacy?.chair_rental_amount ??
      0,
    ),
  }
}

function startOfLocalDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function prorateMonthlyAmount(
  monthlyAmount: number,
  start?: string | Date | null,
  end?: string | Date | null,
) {
  if (!monthlyAmount || monthlyAmount <= 0 || !start || !end) return 0

  const rangeStart = startOfLocalDay(start)
  const rangeEnd = startOfLocalDay(end)
  if (rangeEnd < rangeStart) return 0

  let total = 0
  const cursor = new Date(rangeStart)

  while (cursor <= rangeEnd) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthEnd = new Date(year, month + 1, 0)
    monthEnd.setHours(0, 0, 0, 0)
    const segmentEnd = monthEnd < rangeEnd ? monthEnd : rangeEnd
    const days = Math.floor((segmentEnd.getTime() - cursor.getTime()) / 86400000) + 1

    total += monthlyAmount * (days / daysInMonth)
    cursor.setFullYear(year, month + 1, 1)
  }

  return Math.round((total + Number.EPSILON) * 100) / 100
}

export function calculateBarberCompensation({
  settings,
  serviceRevenue,
  periodStart,
  periodEnd,
}: {
  settings: BarberCompensationSettings
  serviceRevenue: number
  periodStart?: string | Date | null
  periodEnd?: string | Date | null
}) {
  const hasCommission =
    settings.type === 'commission' ||
    settings.type === 'salary_plus_commission'
  const hasFixedSalary =
    settings.type === 'fixed_salary' ||
    settings.type === 'salary_plus_commission'
  const isChairRental = settings.type === 'chair_rental'

  const commissionCost = hasCommission
    ? serviceRevenue * (settings.commissionPercentage / 100)
    : 0
  const fixedSalaryCost = hasFixedSalary
    ? prorateMonthlyAmount(settings.fixedSalaryAmount, periodStart, periodEnd)
    : 0
  const chairRentalRevenue = isChairRental
    ? prorateMonthlyAmount(settings.chairRentalAmount, periodStart, periodEnd)
    : 0

  return {
    commissionCost,
    fixedSalaryCost,
    chairRentalRevenue,
    laborCost: commissionCost + fixedSalaryCost,
    barbershopServiceRevenue: isChairRental ? 0 : serviceRevenue,
    barberRemuneration: commissionCost + fixedSalaryCost,
  }
}

export function getDateRange(values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean).map((value) => String(value).slice(0, 10)).sort()
  return valid.length
    ? { start: valid[0], end: valid[valid.length - 1] }
    : { start: null, end: null }
}

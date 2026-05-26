export const PLAN_FEATURES = {
  basic: {
    maxBarbers: 1,
    memberships: false,
    uploads: false,
    whatsapp: false,
  },

  pro: {
    maxBarbers: 999,
    memberships: true,
    uploads: true,
    whatsapp: true,
  },

  premium: {
    maxBarbers: 999,
    memberships: true,
    uploads: true,
    whatsapp: true,
  },
}

export function getMaxBarbers(plan?: string) {
  return PLAN_FEATURES[
    plan as keyof typeof PLAN_FEATURES
  ]?.maxBarbers ?? 1
}

export function hasFeature(
  plan: string | undefined,
  feature: string
) {
  return PLAN_FEATURES[
    plan as keyof typeof PLAN_FEATURES
  ]?.[
    feature as keyof typeof PLAN_FEATURES.basic
  ] ?? false
}

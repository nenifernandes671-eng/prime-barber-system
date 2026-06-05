'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useTenant } from '@/lib/tenant-context'

type Unit = {
  id: string
  name: string
  active: boolean
}

type UnitContextValue = {
  units: Unit[]
  selectedUnitId: string
  setSelectedUnitId: (id: string) => void
  selectedUnit: Unit | null
  loadingUnits: boolean
}

const UnitContext = createContext<UnitContextValue | null>(null)

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const tenantId = useTenantId()
  const { isPremium } = useTenant()

  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitIdState] = useState('all')
  const [loadingUnits, setLoadingUnits] = useState(true)

  useEffect(() => {
    if (!tenantId || !isPremium) {
      setUnits([])
      setSelectedUnitIdState('all')
      setLoadingUnits(false)
      return
    }

    async function loadUnits() {
      setLoadingUnits(true)

      const { data } = await supabase
        .from('units')
        .select('id, name, active')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('created_at', { ascending: true })

      const rows = data || []
      setUnits(rows)

      const saved = localStorage.getItem(`selected_unit_${tenantId}`)

      if (saved && (saved === 'all' || rows.some((unit) => unit.id === saved))) {
        setSelectedUnitIdState(saved)
      } else {
        setSelectedUnitIdState('all')
      }

      setLoadingUnits(false)
    }

    loadUnits()
  }, [tenantId, isPremium])

  function setSelectedUnitId(id: string) {
    if (!isPremium) return

    setSelectedUnitIdState(id)

    if (tenantId) {
      localStorage.setItem(`selected_unit_${tenantId}`, id)
    }
  }

  const selectedUnit =
    selectedUnitId === 'all'
      ? null
      : units.find((unit) => unit.id === selectedUnitId) || null

  return (
    <UnitContext.Provider
      value={{
        units,
        selectedUnitId,
        setSelectedUnitId,
        selectedUnit,
        loadingUnits,
      }}
    >
      {children}
    </UnitContext.Provider>
  )
}

export function useUnit() {
  const context = useContext(UnitContext)

  if (!context) {
    throw new Error('useUnit precisa estar dentro de UnitProvider')
  }

  return context
}

'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'

import {
  format
} from 'date-fns'

import { ptBR } from 'date-fns/locale'

export default function CalendarPage() {

  const [appointments, setAppointments] =
    useState<any[]>([])
  const tenantId = useTenantId()

  useEffect(() => {

    if (tenantId) fetchAppointments()

  }, [tenantId])

  async function fetchAppointments() {

    if (!tenantId) return

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('appointment_date', {
        ascending: true
      })

    setAppointments(data || [])
  }

  return (

    <main className="min-h-screen bg-[#09090b] text-white p-8">

      <div className="max-w-7xl mx-auto">

        <div className="mb-10">

          <p className="text-zinc-500 uppercase tracking-[0.3em] text-sm">
            Agenda
          </p>

          <h1 className="text-5xl font-bold mt-3">
            Agenda da Barbearia
          </h1>

        </div>

        <div className="grid gap-5">

          {appointments.map(
            (appointment) => (

              <div
                key={appointment.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between"
              >

                <div>

                  <div className="flex items-center gap-3 mb-3">

                    <span
                      className={`w-3 h-3 rounded-full ${
                        appointment.status === 'finished'
                          ? 'bg-green-500'
                          : appointment.status === 'cancelled'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                      }`}
                    />

                    <p className="text-zinc-400 text-sm">

                      {format(
                        new Date(
                          appointment.appointment_date
                        ),
                        "dd 'de' MMMM",
                        {
                          locale: ptBR
                        }
                      )}

                    </p>

                  </div>

                  <h2 className="text-2xl font-bold">

                    {appointment.client_name}

                  </h2>

                  <p className="text-zinc-400 mt-2">

                    {appointment.service}

                  </p>

                </div>

                <div className="mt-5 md:mt-0 text-right">

                  <h3 className="text-3xl font-bold text-yellow-500">

                    {appointment.appointment_time}

                  </h3>

                  <p className="text-zinc-500 mt-2">

                    {appointment.barber}

                  </p>

                </div>

              </div>

            )
          )}

        </div>

      </div>

    </main>
  )
}

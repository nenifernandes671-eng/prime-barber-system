'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function AdminPage() {

  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])

  useEffect(() => {

    async function checkUser() {

      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push('/login')
        return
      }

      setLoading(false)

      fetchAppointments()
    }

    checkUser()

  }, [])

  async function fetchAppointments() {

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })

    if (error) {
      console.log(error)
      return
    }

    setAppointments(data || [])
  }

  async function finishAppointment(id: number) {

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'finished'
      })
      .eq('id', id)

    if (error) {
      console.log(error)
      return
    }

    fetchAppointments()
  }

  async function cancelAppointment(id: number) {

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) {
      console.log(error)
      return
    }

    fetchAppointments()
  }

  async function handleLogout() {

    await supabase.auth.signOut()

    router.push('/login')
  }

  const completedAppointments = appointments.filter(
    (item) => item.status === 'finished'
  ).length

  const cancelledAppointments = appointments.filter(
    (item) => item.status === 'cancelled'
  ).length

  const estimatedRevenue = appointments
  .filter((item) => item.status === 'finished')
  .reduce((total, item) => total + (item.price || 0), 0)

  const monthlyData = [
    { month: 'Jan', appointments: 12 },
    { month: 'Fev', appointments: 19 },
    { month: 'Mar', appointments: 8 },
    { month: 'Abr', appointments: 15 },
    { month: 'Mai', appointments: appointments.length }
  ]

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white text-2xl">
        Carregando...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-12">

      <div className="max-w-7xl mx-auto">

        {/* TOPO */}
        <div className="flex items-center justify-between mb-12">

          <div>

            <h1 className="text-5xl font-bold">
              Painel Admin
            </h1>

            <p className="text-zinc-400 mt-3">
              Gerencie os agendamentos da barbearia
            </p>

          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 px-6 py-3 rounded-xl font-semibold hover:scale-105 transition duration-300"
          >
            Sair
          </button>

        </div>

        {/* CARDS */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <p className="text-zinc-400">
              Total Agendamentos
            </p>

            <h2 className="text-5xl font-bold mt-4">
              {appointments.length}
            </h2>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <p className="text-zinc-400">
              Finalizados
            </p>

            <h2 className="text-5xl font-bold mt-4 text-green-500">
              {completedAppointments}
            </h2>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <p className="text-zinc-400">
              Cancelados
            </p>

            <h2 className="text-5xl font-bold mt-4 text-red-500">
              {cancelledAppointments}
            </h2>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <p className="text-zinc-400">
              Faturamento
            </p>

            <h2 className="text-4xl font-bold mt-4 text-yellow-500">
              R$ {estimatedRevenue}
            </h2>

          </div>

        </div>

        {/* GRÁFICO */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-12">

          <h2 className="text-3xl font-bold mb-8">
            Agendamentos por mês
          </h2>

          <div className="h-[350px]">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart data={monthlyData}>

                <XAxis
                  dataKey="month"
                  stroke="#888"
                />

                <YAxis stroke="#888" />

                <Tooltip />

                <Bar
                  dataKey="appointments"
                  fill="#eab308"
                  radius={[10, 10, 0, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* TABELA */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-zinc-800">

                <tr className="text-left">

                  <th className="p-5">
                    Cliente
                  </th>

                  <th className="p-5">
                    Telefone
                  </th>

                  <th className="p-5">
                    Serviço
                  </th>

                  <th className="p-5">
                    Data
                  </th>

                  <th className="p-5">
                    Horário
                  </th>

                  <th className="p-5">
                    Status
                  </th>

                  <th className="p-5">
                    Ações
                  </th>

                </tr>

              </thead>

              <tbody>

                {appointments.length === 0 ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="p-10 text-center text-zinc-400"
                    >
                      Nenhum agendamento encontrado.
                    </td>

                  </tr>

                ) : (

                  appointments.map((appointment) => (

                    <tr
                      key={appointment.id}
                      className="border-t border-zinc-800 hover:bg-zinc-800/50 transition"
                    >

                      <td className="p-5 font-semibold">
                        {appointment.client_name}
                      </td>

                      <td className="p-5">
                        {appointment.phone}
                      </td>

                      <td className="p-5">
                        {appointment.service}
                      </td>

                      <td className="p-5">
                        {new Date(
                          appointment.appointment_date
                        ).toLocaleDateString('pt-BR')}
                      </td>

                      <td className="p-5">
                        {appointment.appointment_time}
                      </td>

                      <td className="p-5">

                        <span
                          className={`px-4 py-2 rounded-full text-sm font-semibold ${
                            appointment.status === 'finished'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {
                            appointment.status === 'finished'
                              ? 'Finalizado'
                              : 'Agendado'
                          }
                        </span>

                      </td>

                      <td className="p-5">

                        <div className="flex gap-3">

                          <button
                            onClick={() =>
                              finishAppointment(appointment.id)
                            }
                            className="bg-green-600 px-4 py-2 rounded-lg hover:scale-105 transition"
                          >
                            Finalizar
                          </button>

                          <button
                            onClick={() =>
                              cancelAppointment(appointment.id)
                            }
                            className="bg-red-600 px-4 py-2 rounded-lg hover:scale-105 transition"
                          >
                            Cancelar
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </main>
  )
}
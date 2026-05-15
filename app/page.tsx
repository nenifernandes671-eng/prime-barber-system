'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

export default function Home() {

  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [service, setService] = useState('Corte Tradicional')
  const [menuOpen, setMenuOpen] = useState(false)

  const [availableTimes, setAvailableTimes] = useState<string[]>([])

  const services = [
    {
      name: 'Corte Tradicional',
      price: 40
    },
    {
      name: 'Barba Completa',
      price: 35
    },
    {
      name: 'Corte + Barba',
      price: 70
    }
  ]

  async function handleAppointment() {

    if (!clientName || !phone || !date || !time || !service) {
      alert('Preencha todos os campos')
      return
    }

    const selectedService = services.find(
      (item) => item.name === service
    )

    const { error } = await supabase
      .from('appointments')
      .insert([
        {
          client_name: clientName,
          phone: phone,
          service: selectedService?.name,
          price: selectedService?.price,
          barber: 'Rafael',
          appointment_date: date,
          appointment_time: time,
          status: 'scheduled'
        }
      ])

    if (error) {

      if (error.code === '23505') {
        alert('Horário já está ocupado')
        return
      }

      console.log(error)
      alert('Erro ao agendar')
      return
    }

    alert('Agendamento realizado com sucesso!')

    setClientName('')
    setPhone('')
    setDate('')
    setTime('')
    setService('Corte Tradicional')
  }

  async function fetchAvailableTimes(selectedDate: string) {

    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', selectedDate)

    if (error) {
      console.log(error)
      return
    }

    const booked = data.map(
      (item) => item.appointment_time
    )

    const allTimes = [
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00'
    ]

    const available = allTimes.filter(
      (t) => !booked.includes(t)
    )

    setAvailableTimes(available)
  }

  return (
    <main className="bg-black text-white min-h-screen">

      {/* NAVBAR */}
      <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-black/70 border-b border-zinc-800">

  <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">

    <h1 className="text-2xl font-bold text-white">
      PRIME BARBER
    </h1>

    {/* BOTÃO MOBILE */}
    <button
      className="md:hidden text-white text-2xl"
      onClick={() => setMenuOpen(!menuOpen)}
    >
      ☰
    </button>

    {/* MENU DESKTOP */}
    <nav className="hidden md:flex gap-6 text-sm text-zinc-300">
      <a href="#inicio" className="hover:text-yellow-500">Início</a>
      <a href="#servicos" className="hover:text-yellow-500">Serviços</a>
      <a href="#equipe" className="hover:text-yellow-500">Equipe</a>
      <a href="#agendar" className="hover:text-yellow-500">Agendar</a>
      <a href="#contato" className="hover:text-yellow-500">Contato</a>
    </nav>

  </div>

  {/* MENU MOBILE */}
  {menuOpen && (
    <div className="md:hidden bg-black border-t border-zinc-800 px-6 py-4 flex flex-col gap-4 text-zinc-300">

      <a href="#inicio" onClick={() => setMenuOpen(false)}>Início</a>
      <a href="#servicos" onClick={() => setMenuOpen(false)}>Serviços</a>
      <a href="#equipe" onClick={() => setMenuOpen(false)}>Equipe</a>
      <a href="#agendar" onClick={() => setMenuOpen(false)}>Agendar</a>
      <a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a>

    </div>
  )}

</header>

      {/* HERO */}
      <section
        id="inicio"
        className="relative flex flex-col items-center justify-center text-center px-6 min-h-screen overflow-hidden"
      >

        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>

        <div className="relative z-10 max-w-5xl">

          <span className="text-yellow-500 uppercase tracking-[0.3em] text-sm mb-4 block">
            Barbearia Premium
          </span>

          <h2 className="text-5xl md:text-7xl font-bold leading-tight">
            Estilo e presença em cada detalhe
          </h2>

          <p className="text-zinc-300 mt-6 max-w-2xl mx-auto text-lg">
            Atendimento profissional, agendamento online e experiência premium.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center mt-10">

            <a
              href="#agendar"
              className="bg-yellow-500 text-black px-8 py-4 rounded-xl font-semibold hover:scale-105 transition"
            >
              Agendar Agora
            </a>

            <a
              href="#servicos"
              className="border border-zinc-700 px-8 py-4 rounded-xl hover:bg-zinc-900 transition"
            >
              Ver Serviços
            </a>

          </div>

        </div>

      </section>

      {/* SERVIÇOS */}
      <section
        id="servicos"
        className="px-8 py-24 bg-zinc-950"
      >

        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">

            <span className="text-yellow-500 uppercase tracking-[0.3em] text-sm">
              Serviços
            </span>

            <h3 className="text-4xl font-bold mt-4">
              Escolha sua experiência
            </h3>

          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >

            {services.map((item) => (

              <div
                key={item.name}
                className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 hover:border-yellow-500 transition hover:-translate-y-1 duration-300 shadow-xl"
              >

                <h4 className="text-2xl font-bold mb-4">
                  {item.name}
                </h4>

                <p className="text-zinc-400 mb-6">
                  Atendimento premium e acabamento profissional.
                </p>

                <span className="text-yellow-500 text-3xl font-bold">
                  R$ {item.price}
                </span>

              </div>

            ))}

          </motion.div>

        </div>

      </section>

      {/* BARBEIROS */}
      <section
        id="equipe"
        className="px-8 py-24 bg-black"
      >

        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">

            <span className="text-yellow-500 uppercase tracking-[0.3em] text-sm">
              Nossa Equipe
            </span>

            <h3 className="text-4xl font-bold mt-4">
              Barbeiros Profissionais
            </h3>

          </div>

          <div className="grid md:grid-cols-3 gap-8">

            {['Rafael', 'Lucas', 'Matheus'].map((barber) => (

              <div
                key={barber}
                className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-yellow-500 transition"
              >

                <div className="h-80 bg-zinc-800"></div>

                <div className="p-6">

                  <h4 className="text-2xl font-bold">
                    {barber}
                  </h4>

                  <p className="text-zinc-400 mt-2">
                    Atendimento premium e experiência profissional.
                  </p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* AVALIAÇÕES */}
      <section className="px-8 py-24 bg-zinc-950">

        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">

            <span className="text-yellow-500 uppercase tracking-[0.3em] text-sm">
              Avaliações
            </span>

            <h3 className="text-4xl font-bold mt-4">
              O que nossos clientes dizem
            </h3>

          </div>

          <div className="grid md:grid-cols-3 gap-8">

            {[
              {
                name: 'Carlos Henrique',
                text: 'Melhor barbearia da cidade. Atendimento impecável e ambiente premium.'
              },
              {
                name: 'Lucas Martins',
                text: 'Sistema de agendamento muito prático e corte extremamente profissional.'
              },
              {
                name: 'Fernando Alves',
                text: 'Experiência premium do início ao fim. Recomendo sem dúvidas.'
              }
            ].map((review) => (

              <div
                key={review.name}
                className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800"
              >

                <p className="text-zinc-300 leading-relaxed">
                  {review.text}
                </p>

                <div className="mt-6">

                  <p className="font-bold">
                    {review.name}
                  </p>

                  <p className="text-yellow-500">
                    ★★★★★
                  </p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* AGENDAMENTO */}
      <section
        id="agendar"
        className="px-8 py-32 bg-yellow-500 text-black"
      >

        <div className="max-w-5xl mx-auto text-center">

          <h3 className="text-5xl font-bold leading-tight">
            Agende seu horário agora mesmo
          </h3>

          <p className="mt-6 text-xl max-w-2xl mx-auto">
            Atendimento profissional, ambiente premium e praticidade para marcar online.
          </p>

          <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/10 max-w-xl mx-auto mt-12">

            <div className="flex flex-col gap-4">

              <input
                type="text"
                placeholder="Seu nome"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="px-4 py-4 rounded-xl bg-white text-black"
              />

              <input
                type="text"
                placeholder="Seu telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-4 py-4 rounded-xl bg-white text-black"
              />

              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="px-4 py-4 rounded-xl bg-white text-black"
              >

                {services.map((item) => (

                  <option
                    key={item.name}
                    value={item.name}
                  >
                    {item.name} — R$ {item.price}
                  </option>

                ))}

              </select>

              <input
                type="date"
                value={date}
                onChange={(e) => {

                  const newDate = e.target.value

                  setDate(newDate)
                  setTime('')

                  fetchAvailableTimes(newDate)
                }}
                className="px-4 py-4 rounded-xl bg-white text-black"
              />

              <div className="grid grid-cols-3 gap-2">

                {availableTimes.map((t) => (

                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={`py-3 rounded-lg border transition ${
                      time === t
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {t}
                  </button>

                ))}

              </div>

              <button
                onClick={handleAppointment}
                className="bg-black text-white px-8 py-4 rounded-xl font-semibold hover:scale-105 transition shadow-lg"
              >
                Agendar Online
              </button>

              <a
                href="https://wa.me/5547999999999"
                target="_blank"
                className="bg-green-600 text-white px-8 py-4 rounded-xl font-semibold hover:scale-105 transition shadow-lg"
              >
                WhatsApp
              </a>

            </div>

          </div>

        </div>

      </section>

      {/* MAPA */}
      <section className="px-8 py-24 bg-black">

        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-12">

            <span className="text-yellow-500 uppercase tracking-[0.3em] text-sm">
              Localização
            </span>

            <h3 className="text-4xl font-bold mt-4">
              Venha nos visitar
            </h3>

            <p className="text-zinc-400 mt-4">
              Atendimento premium em Joinville - SC
            </p>

          </div>

          <div className="rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">

            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3575.9055225952898!2d-48.817731599999995!3d-26.3295586!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94deb1b0804104c7%3A0xc83329478e4d290a!2sBarbearia%20Tra%C3%A7o%20fino!5e0!3m2!1spt-BR!2sbr!4v1778884228161!5m2!1spt-BR!2sbr" 
              loading="lazy"
              allowFullScreen
              width="100%"
              height="450"
            ></iframe>

          </div>

        </div>

      </section>

      {/* FOOTER */}
      <footer
        id="contato"
        className="bg-zinc-950 border-t border-zinc-800 px-8 py-16"
      >

        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">

          <div>

            <h4 className="text-2xl font-bold text-white">
              PRIME BARBER
            </h4>

            <p className="text-zinc-400 mt-4">
              Estilo, presença e experiência premium em cada atendimento.
            </p>

          </div>

          <div>

            <h5 className="text-white font-semibold mb-4">
              Navegação
            </h5>

            <ul className="space-y-2 text-zinc-400">

              <li><a href="#inicio">Início</a></li>
              <li><a href="#servicos">Serviços</a></li>
              <li><a href="#equipe">Equipe</a></li>
              <li><a href="#contato">Contato</a></li>

            </ul>

          </div>

          <div>

            <h5 className="text-white font-semibold mb-4">
              Contato
            </h5>

            <ul className="space-y-2 text-zinc-400">

              <li>(47) 99999-9999</li>
              <li>contato@primebarber.com</li>
              <li>Joinville - SC</li>

            </ul>

          </div>

          <div>

            <h5 className="text-white font-semibold mb-4">
              Redes Sociais
            </h5>

            <ul className="space-y-2 text-zinc-400">

              <li>Instagram</li>
              <li>Facebook</li>
              <li>TikTok</li>

            </ul>

          </div>

        </div>

        <div className="border-t border-zinc-800 mt-12 pt-8 text-center text-zinc-500 text-sm">
          © 2026 PRIME BARBER. Todos os direitos reservados.
        </div>

      </footer>

      {/* BOTÃO WHATSAPP */}
      <a
        href="https://wa.me/5547999999999"
        target="_blank"
        className="fixed bottom-6 right-6 bg-green-500 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition z-50"
      >
        <span className="text-3xl">
          💬
        </span>
      </a>

    </main>
  )
}
'use client'

import { useState } from 'react'

const PLANS = [
  {
    key: 'basic',
    name: 'Basic',
    price: 39,
    featured: false,
    badge: '',
    description: 'Para barbearias iniciando',
    features: [
      { text: 'Agendamentos online', active: true },
      { text: '1 barbeiro', active: true },
      { text: 'Controle financeiro', active: true },
      { text: 'Dashboard basico', active: true },
      { text: 'Suporte por email', active: true },
      { text: 'Lembrete via WhatsApp', active: false },
      { text: 'Comissoes automaticas', active: false },
      { text: 'Assinaturas de clientes', active: false },
      { text: 'Relatorios avancados', active: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 69,
    featured: true,
    badge: 'MAIS POPULAR',
    description: 'Para barbearias em crescimento',
    features: [
      { text: 'Agendamentos online', active: true },
      { text: 'Barbeiros ilimitados', active: true },
      { text: 'Controle financeiro', active: true },
      { text: 'Dashboard completo', active: true },
      { text: 'Comissoes automaticas', active: true },
      { text: 'Lembrete via WhatsApp', active: true },
      { text: 'Assinaturas de clientes', active: true },
      { text: 'Relatorios avancados', active: true },
      { text: 'Suporte prioritario', active: true },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 189,
    featured: false,
    badge: '',
    description: 'Para redes e barbearias multiunidade',
    features: [
      { text: 'Agendamentos online', active: true },
      { text: 'Barbeiros ilimitados', active: true },
      { text: 'Controle financeiro', active: true },
      { text: 'Dashboard completo', active: true },
      { text: 'Comissoes automaticas', active: true },
      { text: 'Lembrete via WhatsApp', active: true },
      { text: 'Assinaturas de clientes', active: true },
      { text: 'Relatorios avancados', active: true },
      { text: 'Dashboard executivo', active: true },
      { text: 'Multiunidade', active: true },
      { text: 'Clientes inativos', active: true },
      { text: 'Suporte VIP', active: true },
    ],
  },
]

export default function PricingPage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpfCnpj: '',
    telefone: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    slug: '',
    plano: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function openModal(planKey: string) {
    setForm((current) => ({ ...current, plano: planKey }))
    setModal(true)
    setFormError('')
  }

  async function handleCheckout() {
    if (
      !form.nome ||
      !form.email ||
      !form.cpfCnpj ||
      !form.telefone ||
      !form.cep ||
      !form.endereco ||
      !form.numero ||
      !form.bairro ||
      !form.slug
    ) {
      setFormError('Preencha todos os campos.')
      return
    }

    const documentDigits = form.cpfCnpj.replace(/\D/g, '')
    const telefoneDigits = form.telefone.replace(/\D/g, '')
    const cepDigits = form.cep.replace(/\D/g, '')

    if (![11, 14].includes(documentDigits.length)) {
      setFormError('Informe um CPF ou CNPJ valido.')
      return
    }

    if (![10, 11].includes(telefoneDigits.length)) {
      setFormError('Informe um telefone valido com DDD.')
      return
    }

    if (cepDigits.length !== 8) {
      setFormError('Informe um CEP valido.')
      return
    }

    const slugClean = form.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slugClean) {
      setFormError('Digite um link valido para sua barbearia.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slug: slugClean }),
      })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
        return
      }

      setFormError(data.error || 'Erro ao iniciar pagamento.')
      setSubmitting(false)
    } catch {
      setFormError('Erro de conexao. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <main className="pricing-page">
      <nav className="pricing-nav">
        <a className="brand" href="/">
          Korte<span>Barber</span>
        </a>
        <div className="nav-links">
          <a href="/#funcionalidades">Funcionalidades</a>
          <a href="/#como-funciona">Como funciona</a>
          <a href="/pricing">Planos</a>
          <a href="/#depoimentos">Depoimentos</a>
        </div>
        <button className="nav-cta" onClick={() => openModal('pro')}>Comecar gratis</button>
      </nav>

      <section className="pricing-hero">
        <div className="section-label">Planos</div>
        <h1>Escolha o seu plano</h1>
        <p>7 dias de teste gratis em qualquer plano. Cancele quando quiser.</p>
      </section>

      <section className="plans-wrap">
        <div className="plans-grid">
          {PLANS.map((plan) => (
            <article key={plan.key} className={`plan-card ${plan.featured ? 'featured' : ''}`}>
              {plan.badge && <div className="plan-badge">{plan.badge}</div>}
              <p className="plan-name">{plan.name}</p>
              <p className="plan-desc">{plan.description}</p>
              <div className="plan-price">
                <span>R$</span>
                {plan.price}
              </div>
              <p className="plan-period">por mes</p>

              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={feature.active ? 'active' : ''}>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button className="plan-button" onClick={() => openModal(plan.key)}>
                Comecar gratis
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="pricing-footer">
        <div className="brand small">Korte<span>Barber</span></div>
        <div className="legal-links">
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/suporte">Suporte</a>
        </div>
      </footer>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setModal(false)}>x</button>
            <p className="modal-kicker">Comece seu teste</p>
            <h2>Criar sua barbearia</h2>
            <p className="modal-copy">Informe os dados para abrir o checkout seguro.</p>

            <label>
              Nome da barbearia
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Dom Nenem Barber"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voce@email.com"
              />
            </label>

            <label>
              CPF ou CNPJ
              <input
                value={form.cpfCnpj}
                onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
                placeholder="000.000.000-00"
              />
            </label>

            <label>
              Telefone
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </label>

            <label>
              CEP
              <input
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                placeholder="01310-000"
              />
            </label>

            <label>
              Endereco
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Avenida Paulista"
              />
            </label>

            <div className="address-grid">
              <label>
                Numero
                <input
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="1000"
                />
              </label>

              <label>
                Bairro
                <input
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  placeholder="Bela Vista"
                />
              </label>
            </div>

            <label>
              Link publico
              <div className="slug-row">
                <span>kortebarber.com.br/</span>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="sua-barbearia"
                />
              </div>
            </label>

            {formError && <div className="form-error">{formError}</div>}

            <button className="checkout-button" onClick={handleCheckout} disabled={submitting}>
              {submitting ? 'Abrindo checkout...' : 'Ir para pagamento'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pricing-page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 60% 45% at 50% 18%, rgba(201,168,76,0.1), transparent 70%),
            linear-gradient(180deg, #0a0a0a 0%, #111 48%, #070707 100%);
          color: #f5f0e8;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          overflow-x: hidden;
        }

        .pricing-page::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25));
        }

        .pricing-nav {
          position: sticky;
          top: 0;
          z-index: 20;
          height: 84px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 60px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(10,10,10,0.88);
          backdrop-filter: blur(18px);
        }

        .brand {
          color: #f5f0e8;
          text-decoration: none;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 30px;
          letter-spacing: 5px;
          line-height: 1;
        }

        .brand span {
          color: #c9a84c;
        }

        .brand.small {
          font-size: 24px;
        }

        .nav-links {
          display: flex;
          gap: 42px;
        }

        .nav-links a {
          color: #888;
          text-decoration: none;
          text-transform: uppercase;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .nav-links a:hover {
          color: #f5f0e8;
        }

        .nav-cta,
        .plan-button,
        .checkout-button {
          border: 0;
          background: #c9a84c;
          color: #0a0a0a;
          cursor: pointer;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .nav-cta {
          padding: 15px 28px;
          font-size: 12px;
        }

        .pricing-hero {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 72px 24px 46px;
        }

        .section-label {
          color: #c9a84c;
          text-transform: uppercase;
          letter-spacing: 5px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .pricing-hero h1 {
          margin: 0;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(56px, 7vw, 100px);
          line-height: 0.95;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .pricing-hero p {
          margin: 20px auto 0;
          max-width: 620px;
          color: #8e8e8e;
          font-size: 16px;
          line-height: 1.7;
        }

        .plans-wrap {
          position: relative;
          z-index: 1;
          padding: 18px 24px 110px;
        }

        .plans-grid {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
        }

        .plan-card {
          position: relative;
          min-height: 568px;
          padding: 52px 36px 46px;
          border: 1px solid rgba(255,255,255,0.09);
          background: linear-gradient(145deg, rgba(24,24,24,0.92), rgba(10,10,10,0.88));
          display: flex;
          flex-direction: column;
        }

        .plan-card.featured {
          border-color: #c9a84c;
          background:
            radial-gradient(circle at 50% 15%, rgba(201,168,76,0.14), transparent 48%),
            linear-gradient(145deg, rgba(24,21,9,0.96), rgba(10,10,10,0.92));
          transform: translateY(-12px);
          z-index: 2;
        }

        .plan-badge {
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          background: #c9a84c;
          color: #0a0a0a;
          padding: 7px 28px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .plan-name {
          margin: 0 0 10px;
          color: #c9a84c;
          font-size: 14px;
          letter-spacing: 6px;
          text-transform: uppercase;
          font-weight: 900;
        }

        .plan-desc {
          margin: 0 0 22px;
          color: #777;
          min-height: 22px;
          font-size: 13px;
        }

        .plan-price {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 74px;
          line-height: 1;
          letter-spacing: 1px;
        }

        .plan-price span {
          color: #8b8b8b;
          font-size: 26px;
          margin-right: 4px;
          vertical-align: 26px;
        }

        .plan-period {
          margin: 4px 0 34px;
          color: #888;
          font-size: 13px;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 38px;
          display: flex;
          flex-direction: column;
          gap: 13px;
          flex: 1;
        }

        .plan-features li {
          color: rgba(245,240,232,0.35);
          font-size: 14px;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .plan-features li::before {
          content: '✓';
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.25);
          font-size: 12px;
          flex: 0 0 auto;
        }

        .plan-features li.active {
          color: #f5f0e8;
        }

        .plan-features li.active::before {
          color: #c9a84c;
          border-color: #c9a84c;
          background: rgba(201,168,76,0.12);
        }

        .plan-button {
          width: 100%;
          padding: 17px;
          background: transparent;
          border: 1px solid rgba(201,168,76,0.28);
          color: #c9a84c;
        }

        .featured .plan-button {
          background: #c9a84c;
          color: #0a0a0a;
          border-color: #c9a84c;
        }

        .plan-button:hover,
        .nav-cta:hover,
        .checkout-button:hover {
          background: #e8c96b;
          color: #0a0a0a;
        }

        .pricing-footer {
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 34px 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #777;
          font-size: 13px;
        }

        .legal-links {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .legal-links a {
          color: #777;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 12px;
          font-weight: 800;
        }

        .legal-links a:hover {
          color: #c9a84c;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(0,0,0,0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-box {
          position: relative;
          width: min(460px, 100%);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          background: #151515;
          border: 1px solid rgba(201,168,76,0.22);
          padding: 34px;
          box-shadow: 0 40px 100px rgba(0,0,0,0.55);
        }

        .modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #888;
          cursor: pointer;
        }

        .modal-kicker {
          margin: 0 0 8px;
          color: #c9a84c;
          text-transform: uppercase;
          letter-spacing: 4px;
          font-size: 11px;
          font-weight: 800;
        }

        .modal-box h2 {
          margin: 0;
          font-size: 30px;
        }

        .modal-copy {
          margin: 8px 0 24px;
          color: #888;
          font-size: 14px;
        }

        .modal-box label {
          display: block;
          margin-bottom: 16px;
          color: #b8b8b8;
          font-size: 13px;
          font-weight: 700;
        }

        .address-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          gap: 12px;
        }

        .modal-box input {
          width: 100%;
          margin-top: 7px;
          padding: 13px 14px;
          background: rgba(0,0,0,0.35);
          color: #f5f0e8;
          border: 1px solid rgba(255,255,255,0.1);
          outline: none;
          font-size: 14px;
        }

        .slug-row {
          margin-top: 7px;
          display: flex;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.35);
        }

        .slug-row span {
          padding-left: 14px;
          color: #777;
          font-size: 13px;
          white-space: nowrap;
        }

        .slug-row input {
          border: 0;
          background: transparent;
          margin-top: 0;
          padding-left: 2px;
        }

        .form-error {
          margin: 6px 0 16px;
          padding: 11px 13px;
          border: 1px solid rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.1);
          color: #f87171;
          font-size: 13px;
        }

        .checkout-button {
          width: 100%;
          padding: 16px;
        }

        .checkout-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        @media (max-width: 900px) {
          .pricing-nav {
            height: auto;
            padding: 18px 22px;
          }

          .nav-links {
            display: none;
          }

          .plans-grid {
            grid-template-columns: 1fr;
            gap: 16px;
            max-width: 460px;
          }

          .plan-card,
          .plan-card.featured {
            min-height: auto;
            transform: none;
          }

          .pricing-footer {
            padding: 28px 22px;
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }

          .legal-links {
            gap: 18px;
            flex-wrap: wrap;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}

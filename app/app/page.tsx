'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CalendarCheck,
  Crown,
  ExternalLink,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react'

function cleanSlug(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const firstPath = url.pathname.split('/').filter(Boolean)[0]
    return firstPath || ''
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '')
  }
}

export default function AppStartPage() {
  const router = useRouter()
  const [barbershop, setBarbershop] = useState('')
  const [adminShop, setAdminShop] = useState('')

  function goToShop() {
    const slug = cleanSlug(barbershop)
    if (slug) router.push(`/${slug}`)
  }

  function goToAdmin() {
    const slug = cleanSlug(adminShop)
    if (slug) router.push(`/${slug}/admin/login`)
  }

  return (
    <main className="app-shell">
      <style>{`
        .app-shell {
          min-height: 100vh;
          color: #f8f3e8;
          background:
            radial-gradient(circle at 70% 18%, rgba(214,178,74,0.16), transparent 28%),
            radial-gradient(circle at 18% 78%, rgba(59,130,246,0.12), transparent 26%),
            linear-gradient(135deg, #05070d 0%, #0a0f1b 48%, #05070d 100%);
          font-family: var(--font-geist-sans), Arial, sans-serif;
          overflow-x: hidden;
        }
        .app-shell::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 82%);
        }
        .app-wrap {
          position: relative;
          z-index: 1;
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
          padding: 34px 0 42px;
        }
        .app-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 58px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }
        .brand-mark {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #f7d66b, #b98728);
          color: #070a12;
          box-shadow: 0 18px 45px rgba(214,178,74,0.22);
          font-weight: 950;
          letter-spacing: -1px;
        }
        .brand-name {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .brand-sub {
          margin: 1px 0 0;
          font-size: 11px;
          color: #8b95aa;
          letter-spacing: 2.4px;
          text-transform: uppercase;
        }
        .top-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(214,178,74,0.28);
          color: #d6b24a;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          background: rgba(214,178,74,0.08);
        }
        .hero {
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          gap: 42px;
          align-items: center;
        }
        .kicker {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid rgba(214,178,74,0.36);
          color: #d6b24a;
          font-size: 11px;
          letter-spacing: 2.8px;
          text-transform: uppercase;
          font-weight: 900;
          background: rgba(214,178,74,0.06);
        }
        .title {
          margin: 24px 0 18px;
          font-size: clamp(48px, 8vw, 92px);
          line-height: 0.88;
          letter-spacing: -2px;
          font-weight: 950;
        }
        .title span {
          color: #d6b24a;
        }
        .lead {
          margin: 0;
          max-width: 560px;
          color: #9aa4b8;
          font-size: 17px;
          line-height: 1.75;
        }
        .quick {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 28px;
        }
        .quick-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          color: #c8d0df;
          font-size: 12px;
          font-weight: 800;
        }
        .cards {
          display: grid;
          gap: 14px;
        }
        .choice-card {
          position: relative;
          overflow: hidden;
          padding: 22px;
          border-radius: 20px;
          background: rgba(13,19,32,0.82);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 70px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
        }
        .choice-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(214,178,74,0.12), transparent 45%);
          opacity: 0.72;
        }
        .choice-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 16px;
        }
        .choice-icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: rgba(214,178,74,0.12);
          border: 1px solid rgba(214,178,74,0.28);
          color: #d6b24a;
        }
        .choice-title {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
        }
        .choice-copy {
          margin: 6px 0 16px;
          color: #8b95aa;
          font-size: 14px;
          line-height: 1.55;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }
        .input {
          width: 100%;
          min-width: 0;
          height: 48px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.22);
          color: #f8f3e8;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 700;
          outline: none;
        }
        .input:focus {
          border-color: rgba(214,178,74,0.65);
          box-shadow: 0 0 0 4px rgba(214,178,74,0.1);
        }
        .btn {
          height: 48px;
          border: 0;
          border-radius: 13px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #f2d26c, #c4932c);
          color: #070a12;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          box-shadow: 0 18px 42px rgba(214,178,74,0.2);
        }
        .btn.secondary {
          background: rgba(255,255,255,0.06);
          color: #f8f3e8;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: none;
        }
        .split-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 860px) {
          .app-wrap { padding-top: 22px; }
          .app-top { margin-bottom: 36px; }
          .top-link { display: none; }
          .hero { grid-template-columns: 1fr; gap: 28px; }
          .title { font-size: clamp(44px, 15vw, 68px); }
          .choice-card { padding: 18px; border-radius: 18px; }
          .choice-inner { grid-template-columns: 46px 1fr; gap: 12px; }
          .choice-icon { width: 46px; height: 46px; border-radius: 14px; }
          .choice-title { font-size: 19px; }
          .form-row { grid-template-columns: 1fr; }
          .btn { width: 100%; }
        }
      `}</style>

      <div className="app-wrap">
        <header className="app-top">
          <a className="brand" href="/">
            <div className="brand-mark">NB</div>
            <div>
              <p className="brand-name">NexBarber</p>
              <p className="brand-sub">App da barbearia</p>
            </div>
          </a>
          <a className="top-link" href="/pricing">
            Criar minha barbearia
            <ExternalLink size={15} />
          </a>
        </header>

        <section className="hero">
          <div>
            <div className="kicker">
              <Sparkles size={14} />
              Escolha seu acesso
            </div>
            <h1 className="title">
              Entre no <span>NexBarber</span> certo.
            </h1>
            <p className="lead">
              Um app para clientes, barbeiros e donos. Cada pessoa entra no seu painel certo,
              com agenda, atendimentos e gestão separados por barbearia.
            </p>
            <div className="quick">
              <span className="quick-item"><ShieldCheck size={15} /> Acesso seguro</span>
              <span className="quick-item"><CalendarCheck size={15} /> Agenda online</span>
              <span className="quick-item"><Store size={15} /> Multi-barbearia</span>
            </div>
          </div>

          <div className="cards" aria-label="Escolha o tipo de acesso">
            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><UserRound size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou cliente</h2>
                  <p className="choice-copy">Acesse a página pública da barbearia e agende seu horário.</p>
                  <div className="form-row">
                    <input
                      className="input"
                      value={barbershop}
                      onChange={(event) => setBarbershop(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') goToShop() }}
                      placeholder="Ex: domnenem"
                    />
                    <button className="btn" onClick={goToShop}>
                      Abrir agenda <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><Scissors size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou barbeiro</h2>
                  <p className="choice-copy">Entre no seu painel para ver seus horários, clientes e comissões.</p>
                  <a className="btn" href="/barber/login">
                    Login do barbeiro <ArrowRight size={16} />
                  </a>
                </div>
              </div>
            </article>

            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><Crown size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou dono</h2>
                  <p className="choice-copy">Acesse o painel administrativo da sua barbearia ou crie sua conta.</p>
                  <div className="form-row">
                    <input
                      className="input"
                      value={adminShop}
                      onChange={(event) => setAdminShop(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') goToAdmin() }}
                      placeholder="Link da sua barbearia"
                    />
                    <button className="btn" onClick={goToAdmin}>
                      Entrar <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="split-actions" style={{ marginTop: 10 }}>
                    <a className="btn secondary" href="/pricing">Criar barbearia</a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}

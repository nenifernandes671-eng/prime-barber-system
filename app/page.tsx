'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChartColumn,
  Crown,
  DollarSign,
  Scissors,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react'

const features = [
  {
    icon: CalendarDays,
    number: '01',
    name: 'Agendamentos',
    description:
      'Agenda online 24h, confirmação automática por WhatsApp, controle de fila de espera e histórico completo do cliente.',
    badge: 'Online & Presencial',
  },
  {
    icon: DollarSign,
    number: '02',
    name: 'Financeiro',
    description:
      'Controle de caixa, entradas e saídas, relatórios detalhados e fechamento diário/mensal com gráficos em tempo real.',
    badge: 'Relatórios Automáticos',
  },
  {
    icon: ChartColumn,
    number: '03',
    name: 'Dashboard',
    description:
      'Visão geral do negócio com indicadores de desempenho, ranking de barbeiros, ticket médio e muito mais.',
    badge: 'Tempo Real',
  },
  {
    icon: Scissors,
    number: '04',
    name: 'Serviços',
    description:
      'Cadastro ilimitado de serviços com preços, duração e fotos. Pacotes personalizados e promoções com regras flexíveis.',
    badge: 'Ilimitado',
  },
  {
    icon: Trophy,
    number: '05',
    name: 'Comissões',
    description:
      'Configure comissões por barbeiro, por serviço ou por meta. Cálculo automático com extrato individual e transparência total.',
    badge: 'Flexível',
  },
  {
    icon: Crown,
    number: '06',
    name: 'Assinaturas',
    description:
      'Planos mensais para seus clientes, cobrança recorrente automática e controle de benefícios por nível de assinatura.',
    badge: 'Recorrência',
  },
]

const steps = [
  ['Crie sua conta', 'Cadastro em menos de 2 minutos. Sem cartão de crédito para o período de teste.'],
  ['Configure sua barbearia', 'Adicione barbeiros, serviços, horários e valores. Nosso setup guiado facilita tudo.'],
  ['Compartilhe o link', 'Seus clientes agendam pelo link personalizado da sua barbearia no Instagram ou WhatsApp.'],
  ['Acompanhe tudo', 'Dashboard em tempo real com todos os indicadores que você precisa para tomar decisões.'],
]

const plans = [
  {
    name: 'Basic',
    price: '39',
    features: [
      ['Agendamentos online', true],
      ['1 barbeiro', true],
      ['Controle financeiro', true],
      ['Dashboard básico', true],
      ['Lembrete via WhatsApp', false],
      ['Comissões automáticas', false],
      ['Assinaturas de clientes', false],
      ['Relatórios avançados', false],
    ],
  },
  {
    name: 'Pro',
    price: '69',
    featured: true,
    features: [
      ['Agendamentos online', true],
      ['Barbeiros ilimitados', true],
      ['Controle financeiro', true],
      ['Dashboard completo', true],
      ['Comissões automáticas', true],
      ['Lembrete via WhatsApp', true],
      ['Assinaturas de clientes', true],
      ['Relatórios avançados', false],
    ],
  },
  {
    name: 'Premium',
    price: '189',
    features: [
      ['Agendamentos online', true],
      ['Barbeiros ilimitados', true],
      ['Controle financeiro', true],
      ['Dashboard completo', true],
      ['Comissões automáticas', true],
      ['Lembrete via WhatsApp', true],
      ['Assinaturas de clientes', true],
      ['Relatórios avançados', true],
    ],
  },
]

const testimonials = [
  {
    initials: 'RF',
    name: 'Rafael Fonseca',
    role: 'Dono · Barbearia RF, SP',
    text: 'Antes eu controlava tudo no caderninho. Hoje tenho o faturamento, comissões e agendamentos na palma da mão. Aumentei meu faturamento 40% em 3 meses.',
  },
  {
    initials: 'MC',
    name: 'Marcos Carvalho',
    role: 'Dono · The Barber Club, RJ',
    text: 'O sistema de assinaturas foi um divisor de águas. Hoje tenho uma renda previsível todo mês e meus clientes VIP adoram os benefícios exclusivos.',
  },
  {
    initials: 'LB',
    name: 'Lucas Barbosa',
    role: 'Dono · Studio LB, BH',
    text: 'Meus barbeiros amam o controle de comissões. Tudo transparente, sem discussão no final do mês. O suporte é incrível, respondem na hora.',
  },
]

export default function Home() {
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 },
    )

    reveals.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="korte-page">
      <style>{`
        .korte-page {
          --black: #0a0a0a;
          --dark: #111111;
          --card: #161616;
          --border: #222222;
          --gold: #c9a84c;
          --gold-light: #e8c96b;
          --gold-dim: rgba(201, 168, 76, 0.15);
          --white: #f5f0e8;
          --muted: #888;
          min-height: 100vh;
          overflow-x: hidden;
          background: var(--black);
          color: var(--white);
          font-family: "DM Sans", "Segoe UI", Arial, sans-serif;
          font-weight: 300;
        }

        [data-theme='light'] .korte-page,
        [data-theme='light'] .korte-page .hero,
        [data-theme='light'] .korte-page .features,
        [data-theme='light'] .korte-page .pricing,
        [data-theme='light'] .korte-page .cta-section,
        [data-theme='light'] .korte-page .testimonials,
        [data-theme='light'] .korte-page .how,
        [data-theme='light'] .korte-page .korte-footer {
          background-color: var(--black) !important;
          color: var(--white) !important;
        }

        [data-theme='light'] .korte-page .features,
        [data-theme='light'] .korte-page .pricing,
        [data-theme='light'] .korte-page .cta-section {
          background: var(--dark) !important;
        }

        [data-theme='light'] .korte-page .hero {
          background: var(--black) !important;
          border-color: var(--border) !important;
          box-shadow: none !important;
        }

        [data-theme='light'] .korte-page .korte-nav {
          background: rgba(10, 10, 10, 0.85) !important;
          border-color: var(--border) !important;
          box-shadow: none !important;
        }

        [data-theme='light'] .korte-page .hero-bg {
          background:
            radial-gradient(ellipse 60% 60% at 70% 50%, rgba(201, 168, 76, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 10% 80%, rgba(192, 57, 43, 0.06) 0%, transparent 60%) !important;
        }

        [data-theme='light'] .korte-page .hero-lines {
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px) !important;
        }

        [data-theme='light'] .korte-page .feature-card,
        [data-theme='light'] .korte-page .plan,
        [data-theme='light'] .korte-page .testimonial,
        [data-theme='light'] .korte-page .mockup-window,
        [data-theme='light'] .korte-page .mock-card,
        [data-theme='light'] .korte-page .mock-panel {
          background: var(--card) !important;
          border-color: var(--border) !important;
          color: var(--white) !important;
          box-shadow: none !important;
        }

        [data-theme='light'] .korte-page h1,
        [data-theme='light'] .korte-page h2,
        [data-theme='light'] .korte-page h3,
        [data-theme='light'] .korte-page strong,
        [data-theme='light'] .korte-page .nav-logo span,
        [data-theme='light'] .korte-page .footer-logo span,
        [data-theme='light'] .korte-page .feature-name,
        [data-theme='light'] .korte-page .step-title,
        [data-theme='light'] .korte-page .mock-header,
        [data-theme='light'] .korte-page .plan-name,
        [data-theme='light'] .korte-page .test-name,
        [data-theme='light'] .korte-page .btn-ghost {
          color: var(--white) !important;
        }

        [data-theme='light'] .korte-page .hero h1 .accent,
        [data-theme='light'] .korte-page .cta-title .gold,
        [data-theme='light'] .korte-page .nav-logo,
        [data-theme='light'] .korte-page .footer-logo,
        [data-theme='light'] .korte-page .section-label,
        [data-theme='light'] .korte-page .hero-tag,
        [data-theme='light'] .korte-page .stat-number,
        [data-theme='light'] .korte-page .feature-badge,
        [data-theme='light'] .korte-page .stars {
          color: var(--gold) !important;
        }

        [data-theme='light'] .korte-page .hero h1 .line2,
        [data-theme='light'] .korte-page p,
        [data-theme='light'] .korte-page span,
        [data-theme='light'] .korte-page small,
        [data-theme='light'] .korte-page .hero-sub,
        [data-theme='light'] .korte-page .section-desc,
        [data-theme='light'] .korte-page .feature-desc,
        [data-theme='light'] .korte-page .step-text,
        [data-theme='light'] .korte-page .stat-label,
        [data-theme='light'] .korte-page .test-text,
        [data-theme='light'] .korte-page .test-role,
        [data-theme='light'] .korte-page .cta-sub,
        [data-theme='light'] .korte-page .cta-note,
        [data-theme='light'] .korte-page .korte-footer p,
        [data-theme='light'] .korte-page .nav-links a,
        [data-theme='light'] .korte-page .footer-links a {
          color: var(--muted) !important;
        }

        [data-theme='light'] .korte-page .btn-primary,
        [data-theme='light'] .korte-page .nav-cta,
        [data-theme='light'] .korte-page .plan.featured .plan-btn {
          background: var(--gold) !important;
          color: var(--black) !important;
          box-shadow: none !important;
        }

        .korte-page *,
        .korte-page *::before,
        .korte-page *::after {
          box-sizing: border-box;
        }

        .korte-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          opacity: 0.4;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }

        .korte-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 60px;
          background: rgba(10, 10, 10, 0.85);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(20px);
        }

        .nav-logo,
        .footer-logo,
        .hero h1,
        .stat-number,
        .section-title,
        .feature-num,
        .step-num,
        .mock-card-val,
        .plan-price,
        .cta-title {
          font-family: Impact, "Bebas Neue", "Arial Narrow", sans-serif;
          font-weight: 400;
          letter-spacing: 2px;
        }

        .nav-logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: var(--gold);
          font-size: 28px;
          letter-spacing: 4px;
          text-decoration: none;
        }

        .nav-logo span,
        .footer-logo span {
          color: var(--white);
        }

        .nav-links,
        .footer-links {
          display: flex;
          gap: 40px;
          list-style: none;
        }

        .nav-links a,
        .footer-links a {
          color: var(--muted);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 1px;
          text-decoration: none;
          text-transform: uppercase;
          transition: color 0.3s;
        }

        .nav-links a:hover,
        .footer-links a:hover {
          color: var(--gold);
        }

        .nav-cta {
          background: var(--gold);
          color: var(--black);
          padding: 10px 24px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1px;
          text-decoration: none;
          text-transform: uppercase;
          transition: background 0.3s, transform 0.2s;
        }

        .nav-cta:hover {
          background: var(--gold-light);
          transform: translateY(-1px);
        }

        .hero {
          position: relative;
          display: flex;
          min-height: 100vh;
          align-items: center;
          overflow: hidden;
          padding: 0 60px;
        }

        .hero-bg,
        .hero-lines {
          position: absolute;
          inset: 0;
        }

        .hero-bg {
          background:
            radial-gradient(ellipse 60% 60% at 70% 50%, rgba(201, 168, 76, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 10% 80%, rgba(192, 57, 43, 0.06) 0%, transparent 60%);
        }

        .hero-lines {
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 720px;
        }


        .hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
          padding: 6px 14px;
          border: 1px solid var(--gold);
          color: var(--gold);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 3px;
          text-transform: uppercase;
          animation: fadeUp 0.8s ease both;
        }

        .hero-tag::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--gold);
          animation: pulse 2s infinite;
        }

        .hero h1 {
          color: var(--white);
          font-size: clamp(72px, 10vw, 140px);
          line-height: 0.9;
          animation: fadeUp 0.8s 0.1s ease both;
        }

        .hero h1 .accent {
          color: var(--gold);
        }

        .hero h1 .line2 {
          display: block;
          color: var(--muted);
          font-size: 85%;
        }

        .hero-sub {
          max-width: 480px;
          margin: 28px 0 44px;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.7;
          animation: fadeUp 0.8s 0.2s ease both;
        }

        .hero-actions,
        .cta-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .hero-actions {
          animation: fadeUp 0.8s 0.3s ease both;
        }

        .btn-primary {
          display: inline-block;
          padding: 16px 36px;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          background: var(--gold);
          color: var(--black);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          text-decoration: none;
          text-transform: uppercase;
          transition: all 0.3s;
        }

        .btn-primary:hover {
          background: var(--gold-light);
          box-shadow: 0 12px 40px rgba(201, 168, 76, 0.3);
          transform: translateY(-2px);
        }

        .btn-ghost {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--white);
          font-size: 13px;
          letter-spacing: 1px;
          text-decoration: none;
          transition: color 0.3s;
        }

        .btn-ghost:hover {
          color: var(--gold);
        }

        .btn-ghost::before {
          content: "▶";
          font-size: 10px;
        }

        .hero-stats {
          position: absolute;
          right: 60px;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          animation: fadeUp 0.8s 0.5s ease both;
        }

        .stat-item {
          padding-right: 20px;
          border-right: 2px solid var(--gold);
          text-align: right;
        }

        .stat-number {
          color: var(--gold);
          font-size: 42px;
          line-height: 1;
        }

        .stat-label {
          color: var(--muted);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .scroll-line {
          position: absolute;
          bottom: 0;
          left: 60px;
          width: 1px;
          height: 80px;
          background: linear-gradient(to bottom, transparent, var(--gold));
          animation: fadeUp 1s 0.8s ease both;
        }

        .korte-section {
          padding: 120px 60px;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          color: var(--gold);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 4px;
          text-transform: uppercase;
        }

        .section-label::before {
          content: "";
          width: 32px;
          height: 1px;
          background: var(--gold);
        }

        .section-title {
          margin-bottom: 20px;
          font-size: clamp(42px, 6vw, 80px);
          line-height: 1;
        }

        .section-desc {
          max-width: 500px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.8;
        }

        .features,
        .pricing,
        .cta-section {
          background: var(--dark);
        }

        .features-header,
        .testimonials-header,
        .how-inner {
          display: grid;
          align-items: end;
          gap: 60px;
          grid-template-columns: 1fr 1fr;
        }

        .features-header,
        .testimonials-header {
          margin-bottom: 70px;
        }

        .features-grid,
        .pricing-grid,
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .features-grid,
        .pricing-grid {
          gap: 2px;
        }

        .feature-card,
        .plan,
        .testimonial,
        .mockup-window {
          border: 1px solid var(--border);
          background: var(--card);
        }

        .feature-card {
          position: relative;
          overflow: hidden;
          padding: 48px 36px;
          transition: border-color 0.4s, transform 0.3s;
        }

        .feature-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--gold-dim) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
        }

        .feature-card:hover {
          border-color: var(--gold);
          transform: translateY(-4px);
        }

        .feature-card:hover::before {
          opacity: 1;
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          border-radius: 14px;
          color: var(--gold-light);
          background:
            radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 32%),
            linear-gradient(145deg, rgba(201,168,76,0.18), rgba(37,99,235,0.08));
          border: 1px solid rgba(201,168,76,0.26);
          box-shadow: 0 18px 38px rgba(0,0,0,0.32);
        }

        .feature-icon svg {
          width: 24px;
          height: 24px;
          stroke-width: 2.3;
        }

        .feature-num {
          position: absolute;
          top: 24px;
          right: 24px;
          color: rgba(255, 255, 255, 0.04);
          font-size: 48px;
          line-height: 1;
        }

        .feature-name,
        .step-title,
        .mock-header,
        .plan-name,
        .test-name {
          font-weight: 700;
        }

        .feature-name {
          position: relative;
          margin-bottom: 12px;
          color: var(--white);
          font-size: 20px;
        }

        .feature-desc {
          position: relative;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .feature-badge {
          position: relative;
          display: inline-block;
          margin-top: 20px;
          padding: 3px 10px;
          border: 1px solid var(--gold);
          color: var(--gold);
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .how {
          position: relative;
          overflow: hidden;
          background: var(--black);
        }

        .how::before {
          content: "";
          position: absolute;
          top: -200px;
          left: -200px;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201, 168, 76, 0.05) 0%, transparent 70%);
        }

        .how-inner {
          align-items: center;
          gap: 100px;
        }

        .steps {
          display: flex;
          flex-direction: column;
        }

        .step {
          display: flex;
          gap: 24px;
          padding: 32px 0;
          border-bottom: 1px solid var(--border);
        }

        .step:last-child {
          border-bottom: 0;
        }

        .step:hover .step-num {
          border-color: var(--gold);
          color: var(--gold);
        }

        .step-num {
          display: flex;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--border);
          color: var(--border);
          font-size: 32px;
          transition: all 0.3s;
        }

        .step-title {
          margin-bottom: 8px;
          font-size: 18px;
        }

        .step-text {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .mockup-window {
          overflow: hidden;
          border-radius: 4px;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5);
        }

        .mockup-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          background: #1a1a1a;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .dot-r { background: #ff5f57; }
        .dot-y { background: #febc2e; }
        .dot-g { background: #28c840; }

        .mockup-body {
          padding: 28px;
        }

        .mock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 18px;
        }

        .mock-badge {
          padding: 4px 10px;
          background: rgba(40, 200, 64, 0.15);
          color: #28c840;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .mock-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .mock-card {
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 2px;
          background: var(--dark);
        }

        .mock-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .mock-dashboard-card {
          min-height: 105px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(8, 13, 24, 0.9));
        }

        .mock-dashboard-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: rgba(201,168,76,0.14);
          color: var(--gold);
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 12px;
        }

        .mock-dashboard-icon svg {
          width: 18px;
          height: 18px;
          stroke-width: 2.4;
        }

        .mock-dashboard-label {
          color: #64748b;
          font-size: 9px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }

        .mock-dashboard-value {
          margin-top: 5px;
          color: #f8fafc;
          font-size: 20px;
          font-weight: 900;
        }

        .mock-dashboard-layout {
          display: grid;
          grid-template-columns: 1.6fr 0.8fr;
          gap: 12px;
        }

        .mock-panel {
          min-height: 150px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.72);
        }

        .mock-bars {
          height: 92px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-top: 20px;
        }

        .mock-bars span {
          flex: 1;
          min-height: 10px;
          border-radius: 8px 8px 0 0;
          background: linear-gradient(to top, rgba(59,130,246,0.6), #3b82f6);
        }

        .mock-summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #94a3b8;
          font-size: 12px;
        }

        .mock-card-label {
          margin-bottom: 8px;
          color: var(--muted);
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .mock-card-val {
          color: var(--gold);
          font-size: 28px;
        }

        .mock-chart {
          display: flex;
          height: 60px;
          align-items: flex-end;
          gap: 4px;
          margin-top: 16px;
        }

        .bar {
          flex: 1;
          border-top: 2px solid var(--gold);
          border-radius: 2px 2px 0 0;
          background: var(--gold-dim);
          transform-origin: bottom;
          animation: barGrow 1.5s ease both;
        }

        .bar:nth-child(1) { height: 40%; animation-delay: 0.1s; }
        .bar:nth-child(2) { height: 65%; animation-delay: 0.2s; }
        .bar:nth-child(3) { height: 50%; animation-delay: 0.3s; }
        .bar:nth-child(4) { height: 80%; animation-delay: 0.4s; }
        .bar:nth-child(5) { height: 55%; animation-delay: 0.5s; }
        .bar:nth-child(6) { height: 90%; background: var(--gold); animation-delay: 0.6s; }
        .bar:nth-child(7) { height: 70%; animation-delay: 0.7s; }

        .pricing-header,
        .cta-section {
          text-align: center;
        }

        .pricing-header {
          margin-bottom: 70px;
        }

        .pricing-header .section-label,
        .cta-section .section-label {
          justify-content: center;
        }

        .pricing-header .section-label::before,
        .cta-section .section-label::before {
          display: none;
        }

        .pricing-grid {
          max-width: 1000px;
          margin: 0 auto;
        }

        .plan {
          position: relative;
          padding: 48px 36px;
        }

        .plan.featured {
          border-color: var(--gold);
          background: #141209;
        }

        .plan.featured::before {
          content: "MAIS POPULAR";
          position: absolute;
          top: -1px;
          left: 50%;
          padding: 4px 16px;
          background: var(--gold);
          color: var(--black);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          transform: translateX(-50%);
        }

        .plan-name {
          margin-bottom: 20px;
          color: var(--muted);
          font-size: 13px;
          letter-spacing: 3px;
          text-transform: uppercase;
        }

        .plan.featured .plan-name {
          color: var(--gold);
        }

        .plan-price {
          margin-bottom: 4px;
          color: var(--white);
          font-size: 64px;
          line-height: 1;
        }

        .plan-price span {
          display: inline-block;
          margin-top: 16px;
          color: var(--muted);
          font-size: 24px;
          vertical-align: top;
        }

        .plan-period {
          margin-bottom: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        .plan-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 40px;
          padding: 0;
          list-style: none;
        }

        .plan-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 14px;
        }

        .plan-features li.active {
          color: var(--white);
        }

        .plan-features li::before {
          content: "✓";
          display: flex;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 12px;
        }

        .plan-features li.active::before {
          border-color: var(--gold);
          background: var(--gold-dim);
          color: var(--gold);
        }

        .plan-btn {
          display: block;
          padding: 14px;
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          transition: all 0.3s;
        }

        .plan-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
        }

        .plan.featured .plan-btn {
          border-color: var(--gold);
          background: var(--gold);
          color: var(--black);
        }

        .testimonials {
          overflow: hidden;
          background: var(--black);
        }

        .testimonials-grid {
          gap: 20px;
        }

        .testimonial {
          position: relative;
          padding: 36px;
        }

        .testimonial::before {
          content: '"';
          position: absolute;
          top: 10px;
          right: 20px;
          color: rgba(201, 168, 76, 0.2);
          font-family: Impact, "Arial Narrow", sans-serif;
          font-size: 80px;
          line-height: 1;
        }

        .stars {
          margin-bottom: 16px;
          color: var(--gold);
          font-size: 12px;
          letter-spacing: 2px;
        }

        .test-text {
          margin-bottom: 28px;
          color: var(--muted);
          font-size: 15px;
          font-style: italic;
          line-height: 1.8;
        }

        .test-author {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .test-avatar {
          display: flex;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--gold);
          border-radius: 50%;
          background: var(--gold-dim);
          color: var(--gold);
          font-size: 18px;
          font-weight: 700;
        }

        .test-role {
          color: var(--muted);
          font-size: 12px;
        }

        .cta-section {
          position: relative;
          overflow: hidden;
          padding: 140px 60px;
        }

        .cta-section::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 800px;
          height: 400px;
          pointer-events: none;
          background: radial-gradient(ellipse, rgba(201, 168, 76, 0.1) 0%, transparent 70%);
          transform: translate(-50%, -50%);
        }

        .cta-title {
          position: relative;
          margin-bottom: 24px;
          font-size: clamp(56px, 8vw, 110px);
          line-height: 1;
        }

        .cta-title .gold {
          color: var(--gold);
        }

        .cta-sub {
          max-width: 480px;
          margin: 0 auto 48px;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.7;
        }

        .cta-actions {
          position: relative;
          justify-content: center;
        }

        .cta-note {
          margin-top: 20px;
          color: var(--muted);
          font-size: 12px;
        }

        .whatsapp-float {
          position: fixed;
          right: 32px;
          bottom: 32px;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          animation: fadeUp 1s 1s ease both;
        }

        .whatsapp-label {
          padding: 8px 16px;
          border: 1px solid #25d366;
          background: var(--card);
          color: var(--white);
          font-size: 13px;
          font-weight: 500;
          opacity: 0;
          pointer-events: none;
          transform: translateX(10px);
          transition: all 0.3s;
          white-space: nowrap;
        }

        .whatsapp-bubble {
          position: relative;
          display: flex;
          width: 58px;
          height: 58px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #25d366;
          box-shadow: 0 8px 30px rgba(37, 211, 102, 0.4);
          transition: transform 0.3s, box-shadow 0.3s;
        }

        .whatsapp-bubble::before {
          content: "";
          position: absolute;
          inset: -4px;
          border: 2px solid rgba(37, 211, 102, 0.3);
          border-radius: 50%;
          animation: waPulse 2s infinite;
        }

        .whatsapp-float:hover .whatsapp-bubble {
          box-shadow: 0 12px 40px rgba(37, 211, 102, 0.6);
          transform: scale(1.1);
        }

        .whatsapp-float:hover .whatsapp-label {
          opacity: 1;
          transform: translateX(0);
        }

        .whatsapp-icon {
          width: 28px;
          height: 28px;
          fill: white;
        }

        .korte-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 48px 60px;
          border-top: 1px solid var(--border);
          background: var(--black);
        }

        .footer-logo {
          color: var(--gold);
          font-size: 22px;
          letter-spacing: 4px;
        }

        .footer-logo span {
          color: rgba(255, 255, 255, 0.3);
        }

        .korte-footer p {
          color: var(--muted);
          font-size: 13px;
        }

        .footer-links {
          gap: 28px;
        }

        .reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }

        .reveal.visible {
          opacity: 1;
          transform: none;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes barGrow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }

        @keyframes waPulse {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.5); }
        }

        @media (max-width: 900px) {
          .korte-nav {
            padding: 16px 24px;
          }

          .nav-links {
            display: none;
          }

          .korte-section {
            padding: 80px 24px;
          }

          .hero {
            min-height: 92vh;
            padding: 96px 24px 56px;
          }

          .hero h1 {
            font-size: 64px;
          }

          .hero-actions,
          .cta-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .btn-primary,
          .btn-ghost {
            justify-content: center;
            text-align: center;
          }

          .hero-stats,
          .scroll-line {
            display: none;
          }


          .features-header,
          .how-inner,
          .testimonials-header,
          .features-grid,
          .pricing-grid,
          .testimonials-grid {
            grid-template-columns: 1fr;
          }

          .features-header,
          .how-inner,
          .testimonials-header {
            gap: 32px;
          }

          .mock-cards {
            grid-template-columns: 1fr;
          }

          .mock-dashboard-grid,
          .mock-dashboard-layout {
            grid-template-columns: 1fr;
          }

          .korte-footer {
            flex-direction: column;
            gap: 20px;
            padding: 40px 24px;
            text-align: center;
          }

          .footer-links {
            flex-wrap: wrap;
            justify-content: center;
          }

          .whatsapp-float {
            right: 20px;
            bottom: 20px;
          }

          .whatsapp-label {
            display: none;
          }
        }
      `}</style>

      <nav className="korte-nav" aria-label="Navegação principal">
        <a className="nav-logo" href="#inicio">
          Korte<span>Barber</span>
        </a>
        <ul className="nav-links">
          <li><a href="#funcionalidades">Funcionalidades</a></li>
          <li><a href="#como-funciona">Como funciona</a></li>
          <li><a href="#planos">Planos</a></li>
          <li><a href="#depoimentos">Depoimentos</a></li>
        </ul>
        <Link href="/pricing" className="nav-cta">Começar grátis</Link>
      </nav>

      <section className="hero" id="inicio">
        <div className="hero-bg" />
        <div className="hero-lines" />
        <div className="hero-content">
          <div className="hero-tag">Sistema SaaS para Barbearias</div>
          <h1>
            GERENCIE<br />
            <span className="accent">SUA</span>
            <span className="line2">BARBEARIA</span>
          </h1>
          <p className="hero-sub">
            Do agendamento à comissão, do financeiro ao dashboard — tudo em um único sistema pensado para quem vive de navalha e tesoura.
          </p>
          <div className="hero-actions">
            <Link href="/pricing" className="btn-primary">Testar 7 dias grátis</Link>
            <a href="#como-funciona" className="btn-ghost">Ver como funciona</a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-number">3k+</div>
            <div className="stat-label">Barbearias ativas</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">98%</div>
            <div className="stat-label">Satisfação</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">2m+</div>
            <div className="stat-label">Agendamentos</div>
          </div>
        </div>
        <div className="scroll-line" />
      </section>

      <section className="korte-section features" id="funcionalidades">
        <div className="features-header reveal">
          <div>
            <div className="section-label">Funcionalidades</div>
            <h2 className="section-title">TUDO QUE VOCÊ PRECISA</h2>
          </div>
          <p className="section-desc">
            Seis módulos integrados para que você foque no que importa: o corte perfeito e o cliente satisfeito.
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature) => (
            <article className="feature-card reveal" key={feature.number}>
              <span className="feature-icon">
                <feature.icon aria-hidden="true" />
              </span>
              <div className="feature-num">{feature.number}</div>
              <h3 className="feature-name">{feature.name}</h3>
              <p className="feature-desc">{feature.description}</p>
              <span className="feature-badge">{feature.badge}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="korte-section how" id="como-funciona">
        <div className="how-inner">
          <div className="reveal">
            <div className="section-label">Como funciona</div>
            <h2 className="section-title">SIMPLES DE COMEÇAR</h2>
            <p className="section-desc" style={{ marginBottom: 48 }}>
              Em menos de uma hora, sua barbearia já opera com o sistema completo.
            </p>
            <div className="steps">
              {steps.map(([title, text], index) => (
                <div className="step" key={title}>
                  <div className="step-num">{index + 1}</div>
                  <div>
                    <h3 className="step-title">{title}</h3>
                    <p className="step-text">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mockup-window reveal">
            <div className="mockup-bar">
              <div className="dot dot-r" />
              <div className="dot dot-y" />
              <div className="dot dot-g" />
              <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 12 }}>Painel Admin · Dashboard</span>
            </div>
            <div className="mockup-body">
              <div className="mock-header">
                Visão Geral
                <div className="mock-badge">● Ao Vivo</div>
              </div>
              <div className="mock-dashboard-grid">
                <div className="mock-dashboard-card">
                  <div className="mock-dashboard-icon"><DollarSign aria-hidden="true" /></div>
                  <div className="mock-dashboard-label">Receita</div>
                  <div className="mock-dashboard-value">R$ 2.480</div>
                </div>
                <div className="mock-dashboard-card">
                  <div className="mock-dashboard-icon"><TrendingUp aria-hidden="true" /></div>
                  <div className="mock-dashboard-label">Lucro</div>
                  <div className="mock-dashboard-value">R$ 1.920</div>
                </div>
                <div className="mock-dashboard-card">
                  <div className="mock-dashboard-icon"><Scissors aria-hidden="true" /></div>
                  <div className="mock-dashboard-label">Hoje</div>
                  <div className="mock-dashboard-value">18</div>
                </div>
                <div className="mock-dashboard-card">
                  <div className="mock-dashboard-icon"><Users aria-hidden="true" /></div>
                  <div className="mock-dashboard-label">Ticket</div>
                  <div className="mock-dashboard-value">R$ 137</div>
                </div>
              </div>
              <div className="mock-dashboard-layout">
                <div className="mock-panel">
                  <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 14 }}>Receita</div>
                  <div className="mock-bars">
                    {[28, 44, 36, 58, 48, 78, 62, 88].map((h) => (
                      <span key={h} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="mock-panel">
                  <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Resumo</div>
                  <div className="mock-summary-row"><span>Agendamentos</span><strong style={{ color: '#60a5fa' }}>18</strong></div>
                  <div className="mock-summary-row"><span>Finalizados</span><strong style={{ color: '#10b981' }}>14</strong></div>
                  <div className="mock-summary-row"><span>Comissões</span><strong style={{ color: '#c9a84c' }}>R$ 560</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="korte-section pricing" id="planos">
        <div className="pricing-header reveal">
          <div className="section-label">Planos</div>
          <h2 className="section-title">ESCOLHA O SEU PLANO</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>7 dias de teste grátis em qualquer plano. Cancele quando quiser.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`plan reveal${plan.featured ? ' featured' : ''}`} key={plan.name}>
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price"><span>R$</span>{plan.price}</div>
              <div className="plan-period">por mês</div>
              <ul className="plan-features">
                {plan.features.map(([feature, active]) => (
                  <li className={active ? 'active' : ''} key={String(feature)}>{feature}</li>
                ))}
              </ul>
              <Link href="/pricing" className="plan-btn">Começar grátis</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="korte-section testimonials" id="depoimentos">
        <div className="testimonials-header reveal">
          <div>
            <div className="section-label">Depoimentos</div>
            <h2 className="section-title">O QUE DIZEM OS DONOS</h2>
          </div>
          <p className="section-desc">Mais de 3.000 barbearias já transformaram sua gestão com o KorteBarber.</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <article className="testimonial reveal" key={testimonial.initials}>
              <div className="stars">★★★★★</div>
              <p className="test-text">{testimonial.text}</p>
              <div className="test-author">
                <div className="test-avatar">{testimonial.initials}</div>
                <div>
                  <div className="test-name">{testimonial.name}</div>
                  <div className="test-role">{testimonial.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="section-label reveal">Comece agora</div>
        <h2 className="cta-title reveal">
          SUA BARBEARIA<br />
          <span className="gold">NO PRÓXIMO NÍVEL</span>
        </h2>
        <p className="cta-sub reveal">
          Junte-se a mais de 3.000 barbearias que já profissionalizaram sua gestão. 7 dias grátis, sem compromisso.
        </p>
        <div className="cta-actions reveal">
          <Link href="/pricing" className="btn-primary">Criar minha conta grátis</Link>
        </div>
        <p className="cta-note reveal">Sem cartão de crédito · Cancele quando quiser · Suporte em português</p>
      </section>

      <a href="https://wa.me/5547999471941" target="_blank" rel="noreferrer" className="whatsapp-float" title="Fale conosco no WhatsApp">
        <div className="whatsapp-label">Fale conosco!</div>
        <div className="whatsapp-bubble">
          <svg className="whatsapp-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
        </div>
      </a>

      <footer className="korte-footer">
        <div className="footer-logo">Korte<span>Barber</span></div>
        <p>© 2026 KorteBarber. Todos os direitos reservados.</p>
        <div className="footer-links">
          <Link href="/termos">Termos</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/suporte">Suporte</Link>
        </div>
      </footer>
    </main>
  )
}

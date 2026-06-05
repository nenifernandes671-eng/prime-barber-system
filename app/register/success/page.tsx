'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SuccessContent() {
  const params = useSearchParams()
  const slug = params.get('slug') || ''
  const loginHref = slug ? `/${slug}/admin/login` : '/app'

  return (
    <div style={S.root}>
      <div style={S.glow1} />
      <div style={S.glow2} />

      <div style={S.card}>
        <div style={S.iconWrap}>✓</div>
        <h1 style={S.title}>Pagamento confirmado!</h1>
        <p style={S.sub}>
          Sua conta KorteBarber foi criada. Entre no painel com o e-mail e a senha cadastrados no checkout.
        </p>

        <div style={S.infoBox}>
          <p style={S.infoText}>
            O acesso ao painel e liberado automaticamente assim que o pagamento for confirmado pelo Asaas.
          </p>
        </div>

        <div style={S.steps}>
          {[
            { icon: '1', text: 'Pagamento confirmado' },
            { icon: '2', text: 'Assinatura ativada' },
            { icon: '3', text: 'Acesse seu painel' },
          ].map((step) => (
            <div key={step.text} style={S.step}>
              <span style={S.stepIcon}>{step.icon}</span>
              <span style={S.stepText}>{step.text}</span>
            </div>
          ))}
        </div>

        <Link href={loginHref} style={S.btn}>
          Entrar no painel
        </Link>

        <p style={S.support}>
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#020617' }} />}>
      <SuccessContent />
    </Suspense>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24, position: 'relative', overflow: 'hidden' },
  glow1: { position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)', top: -100, right: -100, pointerEvents: 'none' },
  glow2: { position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'rgba(59,130,246,0.08)', filter: 'blur(120px)', bottom: -100, left: -100, pointerEvents: 'none' },
  card: { maxWidth: 480, width: '100%', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '48px 40px', textAlign: 'center', position: 'relative', zIndex: 2 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px', display: 'grid', placeItems: 'center', color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)', fontSize: 36, fontWeight: 900 },
  title: { fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: '0 0 12px' },
  sub: { color: '#94a3b8', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' },
  infoBox: { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 28 },
  infoText: { margin: 0, color: '#bfdbfe', fontSize: 14, lineHeight: 1.6 },
  steps: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 },
  step: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 16px' },
  stepIcon: { width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(37,99,235,0.18)', color: '#93c5fd', fontSize: 12, fontWeight: 900 },
  stepText: { fontSize: 14, color: '#cbd5e1', fontWeight: 600 },
  btn: { display: 'block', padding: '13px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
  support: { color: '#475569', fontSize: 12, marginTop: 16 },
}

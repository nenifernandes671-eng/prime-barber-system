'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={S.root}>
      <div style={S.glow1} />
      <div style={S.glow2} />

      <div style={S.card}>
        <div style={S.iconWrap}>✅</div>
        <h1 style={S.title}>Pagamento confirmado!</h1>
        <p style={S.sub}>
          Sua barbearia está sendo configurada. Você receberá um email com os dados de acesso em instantes.
        </p>

        <div style={S.infoBox}>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            📧 Verifique sua caixa de entrada — enviamos um link de acesso para o seu email.
          </p>
        </div>

        <div style={S.steps}>
          {[
            { icon: '📧', text: 'Verifique seu email' },
            { icon: '🔑', text: 'Clique no link de acesso' },
            { icon: '✂', text: 'Configure sua barbearia' },
          ].map((step, i) => (
            <div key={i} style={S.step}>
              <span style={S.stepIcon}>{step.icon}</span>
              <span style={S.stepText}>{step.text}</span>
            </div>
          ))}
        </div>

        <Link href="/" style={S.btn}>
          Voltar para o início
        </Link>

        <p style={{ color: '#334155', fontSize: 12, marginTop: 16 }}>
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
  iconWrap: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: '0 0 12px' },
  sub: { color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' },
  infoBox: { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 28 },
  steps: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 },
  step: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 16px' },
  stepIcon: { fontSize: 20 },
  stepText: { fontSize: 14, color: '#cbd5e1', fontWeight: 500 },
  btn: { display: 'block', padding: '13px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
}
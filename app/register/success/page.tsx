'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function SuccessContent() {
  const router = useRouter()
  const params = useSearchParams()
  const slug = params.get('slug') || ''
  const loginHref = slug ? `/${slug}/admin/login` : '/app'
  const [attempts, setAttempts] = useState(0)
  const [activated, setActivated] = useState(false)
  const [message, setMessage] = useState('Estamos ativando sua conta...')

  const stepTwoText = useMemo(() => {
    if (activated) return 'Conta ativada'
    if (attempts > 10) return 'Aguardando confirmacao do Asaas'
    return 'Ativando sua conta'
  }, [activated, attempts])

  useEffect(() => {
    if (!slug || activated) return

    let cancelled = false

    async function checkActivation() {
      try {
        const response = await fetch(`/api/asaas/activation-status?slug=${encodeURIComponent(slug)}`)
        const result = await response.json().catch(() => ({}))

        if (cancelled) return

        if (result.active) {
          setActivated(true)
          setMessage('Conta ativada. Redirecionando para o login...')
          setTimeout(() => router.replace(loginHref), 1200)
          return
        }

        setAttempts((current) => current + 1)
        setMessage('Pagamento recebido. Estamos aguardando a confirmacao do Asaas.')
      } catch {
        if (!cancelled) {
          setAttempts((current) => current + 1)
          setMessage('Ainda estamos tentando confirmar sua ativacao.')
        }
      }
    }

    checkActivation()
    const timer = setInterval(checkActivation, 4000)
    const stopTimer = setTimeout(() => clearInterval(timer), 60000)

    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(stopTimer)
    }
  }, [slug, activated, router, loginHref])

  return (
    <div style={S.root}>
      <div style={S.glow1} />
      <div style={S.glow2} />

      <div style={S.card}>
        <div style={activated ? S.iconWrapOk : S.iconWrap}>
          {activated ? '✓' : <span style={S.spinner} />}
        </div>
        <h1 style={S.title}>{activated ? 'Conta ativada!' : 'Estamos ativando sua conta'}</h1>
        <p style={S.sub}>
          {activated
            ? 'Tudo pronto. Agora entre no painel com o e-mail e a senha cadastrados.'
            : 'Seu pagamento foi iniciado. Assim que o Asaas confirmar, voce sera enviado para o login automaticamente.'}
        </p>

        <div style={S.infoBox}>
          <p style={S.infoText}>{message}</p>
        </div>

        <div style={S.steps}>
          {[
            { icon: '1', text: 'Pagamento recebido' },
            { icon: '2', text: stepTwoText },
            { icon: '3', text: 'Entrar no painel' },
          ].map((step, index) => (
            <div key={step.text} style={S.step}>
              <span style={index === 1 && !activated ? S.stepIconLoading : S.stepIcon}>{step.icon}</span>
              <span style={S.stepText}>{step.text}</span>
            </div>
          ))}
        </div>

        <Link href={loginHref} style={S.btn}>
          {activated ? 'Entrar agora' : 'Ir para o login'}
        </Link>

        <p style={S.support}>
          Pix costuma confirmar em instantes. Boleto pode levar mais tempo para compensar.
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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
  card: { maxWidth: 500, width: '100%', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '48px 40px', textAlign: 'center', position: 'relative', zIndex: 2 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.22)' },
  iconWrapOk: { width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px', display: 'grid', placeItems: 'center', color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)', fontSize: 36, fontWeight: 900 },
  spinner: { width: 30, height: 30, borderRadius: 999, border: '3px solid rgba(147,197,253,0.22)', borderTopColor: '#60a5fa', animation: 'spin .8s linear infinite' },
  title: { fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: '0 0 12px' },
  sub: { color: '#94a3b8', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' },
  infoBox: { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 28 },
  infoText: { margin: 0, color: '#bfdbfe', fontSize: 14, lineHeight: 1.6 },
  steps: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 },
  step: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 16px' },
  stepIcon: { width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(37,99,235,0.18)', color: '#93c5fd', fontSize: 12, fontWeight: 900 },
  stepIconLoading: { width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(245,158,11,0.16)', color: '#fbbf24', fontSize: 12, fontWeight: 900 },
  stepText: { fontSize: 14, color: '#cbd5e1', fontWeight: 600 },
  btn: { display: 'block', padding: '13px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
  support: { color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 16 },
}

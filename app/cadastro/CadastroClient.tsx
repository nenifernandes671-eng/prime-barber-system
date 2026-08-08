'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type PlanKey = 'basic' | 'pro' | 'premium'
type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

const PLANS: Record<PlanKey, { name: string; price: number }> = {
  basic: { name: 'Basic', price: 39 },
  pro: { name: 'Pro', price: 69 },
  premium: { name: 'Premium', price: 99 },
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CadastroClient({ initialPlan, initialCycle }: { initialPlan: PlanKey; initialCycle: BillingCycle }) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanKey>(initialPlan)
  const [billingCycle] = useState<BillingCycle>(initialCycle)
  const [ownerName, setOwnerName] = useState('')
  const [barbershopName, setBarbershopName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const generatedSlug = useMemo(() => normalizeSlug(slug || barbershopName), [barbershopName, slug])
  const selectedPlan = PLANS[plan]

  async function submit() {
    const phoneDigits = phone.replace(/\D/g, '')
    const documentDigits = cpfCnpj.replace(/\D/g, '')

    if (!ownerName.trim() || !barbershopName.trim() || !email.trim() || !phoneDigits || !generatedSlug || !password || !confirmPassword) {
      setError('Preencha todos os campos para criar sua conta.')
      return
    }

    if (![10, 11].includes(phoneDigits.length)) {
      setError('Informe um telefone valido com DDD.')
      return
    }

    if (![11, 14].includes(documentDigits.length)) {
      setError('Informe um CPF ou CNPJ valido.')
      return
    }

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao conferem.')
      return
    }

    if (!acceptedTerms) {
      setError('Aceite os Termos de Uso e a Politica de Privacidade.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano: plan,
          billingCycle,
          nome: ownerName.trim(),
          nomeBarbearia: barbershopName.trim(),
          email: email.trim().toLowerCase(),
          telefone: phoneDigits,
          cpfCnpj: documentDigits,
          slug: generatedSlug,
          password,
          confirmPassword,
          acceptedTerms,
          marketingOptIn,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.created) {
        throw new Error(data.error || 'Nao foi possivel criar sua conta.')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        router.replace(`/${data.slug || generatedSlug}/login`)
        return
      }

      router.replace(`/${data.slug || generatedSlug}/admin`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro de conexao. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <main className="signup-page">
      <a className="brand" href="/">
        Korte<span>Barber</span>
      </a>

      <section className="signup-shell">
        <div className="intro">
          <p className="kicker">Teste gratis</p>
          <h1>Crie sua conta</h1>
          <p className="copy">Seu acesso fica pronto na hora com 30 dias de teste no plano escolhido.</p>
          <div className="selected-plan">
            <span>Plano selecionado</span>
            <strong>{selectedPlan.name}</strong>
            <small>R$ {selectedPlan.price * (billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 3 : 12)} apos o teste ({billingCycle === 'monthly' ? 'mensal' : billingCycle === 'quarterly' ? 'trimestral' : 'anual'})</small>
          </div>
        </div>

        <form className="signup-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="plan-row">
            {(Object.keys(PLANS) as PlanKey[]).map((item) => (
              <button type="button" key={item} className={plan === item ? 'active' : ''} onClick={() => setPlan(item)}>
                {PLANS[item].name}
              </button>
            ))}
          </div>

          <label>
            Seu nome
            <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Nome do responsavel" />
          </label>

          <label>
            Nome da barbearia
            <input value={barbershopName} onChange={(event) => setBarbershopName(event.target.value)} placeholder="Ex: Dom Barber" />
          </label>

          <label>
            Link publico
            <div className="slug-row">
              <span>kortebarber.com.br/</span>
              <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder={generatedSlug || 'sua-barbearia'} />
            </div>
          </label>

          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" />
          </label>

          <label>
            Telefone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 98765-4321" />
          </label>

          <label>
            CPF ou CNPJ
            <input value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} placeholder="000.000.000-00" />
          </label>

          <div className="password-grid">
            <label>
              Senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" />
            </label>
            <label>
              Confirmar senha
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a senha" />
            </label>
          </div>

          <label className="check-row">
            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span>Li e aceito os <a href="/termos">Termos de Uso</a> e a <a href="/privacidade">Politica de Privacidade</a>.</span>
          </label>

          <label className="check-row">
            <input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} />
            <span>Quero receber novidades e orientacoes da KorteBarber.</span>
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="submit-button" type="submit" disabled={submitting}>
            {submitting ? 'Criando conta...' : 'Criar conta gratis'}
          </button>
        </form>
      </section>

      <style jsx>{`
        .signup-page {
          min-height: 100vh;
          padding: 30px 22px 70px;
          background:
            radial-gradient(ellipse 60% 42% at 50% 10%, rgba(18,104,255,0.22), transparent 70%),
            linear-gradient(180deg, #060914 0%, #0b0f19 52%, #05070d 100%);
          color: #f5f0e8;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
        }

        .brand {
          display: inline-block;
          color: #f5f0e8;
          text-decoration: none;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 30px;
          letter-spacing: 5px;
          line-height: 1;
        }

        .brand span {
          color: #1268ff;
        }

        .signup-shell {
          width: min(1040px, 100%);
          margin: 54px auto 0;
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(320px, 1fr);
          gap: 38px;
          align-items: start;
        }

        .intro {
          padding-top: 34px;
        }

        .kicker {
          margin: 0 0 16px;
          color: #58a6ff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 4px;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(58px, 8vw, 104px);
          line-height: 0.95;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .copy {
          max-width: 470px;
          margin: 22px 0 30px;
          color: #9aa4b2;
          font-size: 16px;
          line-height: 1.7;
        }

        .selected-plan {
          width: min(340px, 100%);
          padding: 20px;
          border: 1px solid rgba(88,166,255,0.22);
          border-radius: 18px;
          background: rgba(8,17,32,0.72);
        }

        .selected-plan span,
        .selected-plan small {
          display: block;
          color: #8b96a8;
          font-size: 12px;
        }

        .selected-plan strong {
          display: block;
          margin: 7px 0;
          color: #fff;
          font-size: 24px;
        }

        .signup-form {
          padding: 30px;
          border: 1px solid rgba(88,166,255,0.22);
          border-radius: 24px;
          background: rgba(15,23,36,0.94);
          box-shadow: 0 36px 90px rgba(0,0,0,0.34);
        }

        .plan-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .plan-row button {
          min-height: 44px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          background: rgba(0,0,0,0.24);
          color: #9aa4b2;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .plan-row button.active {
          border-color: #1268ff;
          background: rgba(18,104,255,0.18);
          color: #fff;
        }

        label {
          display: block;
          margin-bottom: 15px;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 800;
        }

        input {
          width: 100%;
          min-height: 48px;
          margin-top: 7px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          outline: none;
          background: rgba(0,0,0,0.30);
          color: #f5f0e8;
          font-size: 14px;
        }

        input:focus {
          border-color: rgba(88,166,255,0.72);
        }

        .slug-row {
          margin-top: 7px;
          display: flex;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          background: rgba(0,0,0,0.30);
          overflow: hidden;
        }

        .slug-row span {
          padding-left: 14px;
          color: #7f8b9d;
          font-size: 13px;
          white-space: nowrap;
        }

        .slug-row input {
          border: 0;
          background: transparent;
          margin-top: 0;
          border-radius: 0;
          padding-left: 3px;
        }

        .password-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .check-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: #9aa4b2;
          font-size: 12px;
          line-height: 1.45;
        }

        .check-row input {
          width: 16px;
          min-height: 16px;
          margin: 1px 0 0;
          flex: 0 0 auto;
        }

        .check-row a {
          color: #58a6ff;
        }

        .form-error {
          margin: 4px 0 16px;
          padding: 12px 14px;
          border: 1px solid rgba(248,113,113,0.35);
          border-radius: 12px;
          background: rgba(127,29,29,0.22);
          color: #fecaca;
          font-size: 13px;
          line-height: 1.5;
        }

        .submit-button {
          width: 100%;
          min-height: 54px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #1268ff, #0047d6);
          box-shadow: 0 16px 44px rgba(18,104,255,0.25);
          color: #fff;
          cursor: pointer;
          font-weight: 900;
          letter-spacing: 1.7px;
          text-transform: uppercase;
        }

        .submit-button:disabled {
          opacity: 0.68;
          cursor: wait;
        }

        @media (max-width: 840px) {
          .signup-shell {
            grid-template-columns: 1fr;
            margin-top: 34px;
          }

          .intro {
            padding-top: 0;
          }

          .signup-form {
            padding: 22px;
          }

          .password-grid,
          .plan-row {
            grid-template-columns: 1fr;
          }

          .slug-row {
            display: block;
            padding-top: 10px;
          }

          .slug-row input {
            padding-left: 14px;
          }
        }
      `}</style>
    </main>
  )
}

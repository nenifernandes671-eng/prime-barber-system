import Link from 'next/link'

export default function TermosPage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/" style={styles.back}>Voltar para o inicio</Link>
        <p style={styles.kicker}>KorteBarber</p>
        <h1 style={styles.title}>Termos de uso</h1>
        <p style={styles.muted}>Ultima atualizacao: maio de 2026</p>

        <div style={styles.content}>
          <p>
            Ao contratar ou utilizar o KorteBarber, voce concorda em usar a plataforma de forma
            licita, mantendo seus dados de acesso protegidos e informando dados verdadeiros da
            sua barbearia.
          </p>
          <p>
            O KorteBarber fornece ferramentas para agenda online, gestao financeira, barbeiros,
            servicos, clientes e assinaturas. Cada barbearia e responsavel pelos dados que cadastra,
            pelos atendimentos prestados e pela relacao com seus clientes.
          </p>
          <p>
            Os planos sao cobrados de forma recorrente conforme o plano escolhido. O acesso pode
            ser suspenso em caso de falta de pagamento, uso indevido, tentativa de fraude ou
            violacao destes termos.
          </p>
          <p>
            Podemos atualizar funcionalidades, corrigir erros e melhorar a plataforma continuamente.
            Em caso de duvidas sobre uso, cancelamento ou cobranca, entre em contato pelo suporte.
          </p>
        </div>
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 50% 0%, rgba(201,168,76,0.12), transparent 42%), #080808',
    color: '#f5f0e8',
    padding: '72px 20px',
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  card: {
    maxWidth: 820,
    margin: '0 auto',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(18,18,18,0.82)',
    padding: 36,
  },
  back: {
    color: '#c9a84c',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  kicker: {
    margin: '34px 0 10px',
    color: '#c9a84c',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: 800,
  },
  title: {
    margin: 0,
    fontSize: 46,
    lineHeight: 1,
  },
  muted: {
    color: '#888',
    margin: '12px 0 28px',
  },
  content: {
    display: 'grid',
    gap: 16,
    color: '#c9c3b8',
    lineHeight: 1.8,
    fontSize: 15,
  },
}

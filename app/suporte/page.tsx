import Link from 'next/link'

export default function SuportePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/" style={styles.back}>Voltar para o inicio</Link>
        <p style={styles.kicker}>NexBarber</p>
        <h1 style={styles.title}>Suporte</h1>
        <p style={styles.muted}>Precisa de ajuda com acesso, pagamento ou configuracao?</p>

        <div style={styles.grid}>
          <div style={styles.box}>
            <h2 style={styles.boxTitle}>Email</h2>
            <p style={styles.text}>Envie uma mensagem para suporte@nexbarber.com.br.</p>
          </div>
          <div style={styles.box}>
            <h2 style={styles.boxTitle}>Assinatura</h2>
            <p style={styles.text}>Para duvidas sobre plano, checkout, vencimento ou cancelamento.</p>
          </div>
          <div style={styles.box}>
            <h2 style={styles.boxTitle}>Acesso</h2>
            <p style={styles.text}>Ajuda com login do administrador, login do barbeiro e redefinicao de senha.</p>
          </div>
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
    maxWidth: 900,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  box: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.22)',
    padding: 20,
  },
  boxTitle: {
    margin: '0 0 10px',
    color: '#c9a84c',
    fontSize: 16,
  },
  text: {
    margin: 0,
    color: '#c9c3b8',
    lineHeight: 1.7,
    fontSize: 14,
  },
}

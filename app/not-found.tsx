export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#161b27',
          border: '1px solid #1e2535',
          borderRadius: 20,
          padding: 40,
          width: '100%',
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 60,
            marginBottom: 20,
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            color: '#fff',
            fontSize: 32,
            marginBottom: 12,
          }}
        >
          404
        </h1>

        <p
          style={{
            color: '#94a3b8',
            fontSize: 15,
            marginBottom: 24,
          }}
        >
          Página não encontrada.
        </p>

        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 20px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 10,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Voltar ao início
        </a>
      </div>
    </div>
  )
}
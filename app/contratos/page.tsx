import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contratos, termos e privacidade | KorteBarber',
  description: 'Contrato de licença, termos de uso e política de privacidade do KorteBarber.',
}

const updatedAt = '22 de julho de 2026'

const sections = [
  {
    title: '1. Aceite e uso da plataforma',
    body: [
      'Ao criar uma conta, entrar com login social ou utilizar o KorteBarber, você declara que leu e aceitou este Contrato de Licença, os Termos de Uso e a Política de Privacidade.',
      'O KorteBarber oferece uma plataforma para consulta de barbearias, agendamento de serviços, gestão de clientes, profissionais, horários, assinaturas, cupons, pagamentos e comunicação entre cliente e barbearia.',
    ],
  },
  {
    title: '2. Conta, segurança e informações cadastradas',
    body: [
      'O usuário deve informar dados verdadeiros e manter seus dados atualizados, incluindo nome, e-mail, telefone, endereço e demais informações necessárias para uso do app.',
      'Cada usuário é responsável por proteger seu acesso, senha, dispositivos conectados e qualquer atividade realizada em sua conta.',
    ],
  },
  {
    title: '3. Responsabilidade das barbearias',
    body: [
      'Cada barbearia é responsável por serviços, preços, horários, profissionais, fotos, avaliações, políticas de cancelamento, formas de pagamento e atendimento prestado ao cliente.',
      'O KorteBarber disponibiliza a tecnologia, mas a execução do serviço contratado, a qualidade do atendimento e o relacionamento comercial direto são de responsabilidade da barbearia escolhida.',
    ],
  },
  {
    title: '4. Agendamentos, cancelamentos e histórico',
    body: [
      'Agendamentos criados pelo app ficam vinculados ao cliente, à barbearia e ao profissional selecionado. Horários podem ser recusados quando estiverem indisponíveis ou quando violarem regras da agenda.',
      'Cancelamentos, reagendamentos, tolerância de atraso e cobrança por ausência podem seguir políticas definidas pela barbearia e exibidas no momento do agendamento.',
    ],
  },
  {
    title: '5. Pagamentos, Pix, cartões e assinaturas',
    body: [
      'Quando a barbearia habilitar pagamentos pelo app, as cobranças poderão ser processadas por gateway de pagamento contratado ou configurado pela própria barbearia, como ASAAS ou outro provedor compatível.',
      'O KorteBarber não deve armazenar número completo de cartão. Dados sensíveis de pagamento devem ser tokenizados ou processados pelo gateway. O app pode armazenar identificadores seguros, últimos dígitos, bandeira, status de pagamento e comprovantes operacionais.',
      'Planos e assinaturas podem ser criados pela barbearia. A liberação automática depende da confirmação do pagamento pelo gateway ou da confirmação manual pela barbearia quando escolhido pagamento presencial.',
    ],
  },
  {
    title: '6. Licença de uso',
    body: [
      'O KorteBarber concede ao usuário uma licença limitada, pessoal, não exclusiva, intransferível e revogável para utilizar o aplicativo e o sistema conforme estes termos.',
      'É proibido copiar, vender, sublicenciar, modificar, explorar engenharia reversa, acessar indevidamente, automatizar abusivamente ou usar a plataforma para fraude, spam, violação de direitos ou atividade ilícita.',
    ],
  },
  {
    title: '7. Dados pessoais coletados',
    body: [
      'Podemos tratar dados como nome, e-mail, telefone, foto, data de nascimento, endereços, localização aproximada, preferências, agendamentos, avaliações, histórico, cupons, assinaturas, notificações, identificadores de pagamento e dados técnicos do dispositivo.',
      'Em login social, como Google, podemos receber dados autorizados pelo provedor, como nome, e-mail e foto de perfil, para criar ou atualizar sua conta.',
    ],
  },
  {
    title: '8. Finalidades do tratamento',
    body: [
      'Os dados são usados para autenticar usuários, criar perfis, exibir barbearias próximas, confirmar agendamentos, processar pagamentos, enviar lembretes e notificações, prevenir fraude, prestar suporte e melhorar a experiência.',
      'Dados também podem ser mantidos para obrigações legais, segurança, auditoria, histórico financeiro e proteção dos direitos do usuário, da barbearia e do KorteBarber.',
    ],
  },
  {
    title: '9. Compartilhamento de dados',
    body: [
      'Dados necessários ao atendimento podem ser compartilhados com a barbearia escolhida, profissionais vinculados, provedores de hospedagem, banco de dados, e-mail, notificações, mapas, autenticação e pagamentos.',
      'Também podemos compartilhar informações quando exigido por lei, ordem judicial, autoridade competente ou para proteger a segurança da plataforma.',
    ],
  },
  {
    title: '10. Direitos do titular',
    body: [
      'Conforme a Lei Geral de Proteção de Dados, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento, quando aplicável.',
      'Alguns dados podem permanecer armazenados quando houver obrigação legal, prevenção a fraude, segurança, auditoria ou exercício regular de direitos.',
    ],
  },
  {
    title: '11. Fotos, avaliações e conteúdo enviado',
    body: [
      'Ao enviar fotos, avaliações, comentários ou informações no app, o usuário declara possuir direito de uso desse conteúdo e autoriza sua exibição dentro da experiência da barbearia, quando aplicável.',
      'Conteúdos ofensivos, falsos, abusivos, discriminatórios, ilegais ou que violem direitos de terceiros podem ser removidos.',
    ],
  },
  {
    title: '12. Alterações destes documentos',
    body: [
      'Podemos atualizar este documento para refletir melhorias no app, novas integrações, mudanças legais ou ajustes operacionais. A versão vigente será publicada nesta página.',
      'Mudanças relevantes poderão exigir novo aceite dentro do aplicativo.',
    ],
  },
]

export default function ContratosPage() {
  return (
    <main className="contracts-page">
      <nav className="contracts-nav" aria-label="Navegação dos contratos">
        <Link href="/" className="brand" aria-label="Voltar para o início">
          <span className="brand-mark">K</span>
          <span>KorteBarber</span>
        </Link>
        <div className="nav-actions">
          <Link href="/termos">Termos antigos</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/" className="cta">Voltar ao site</Link>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">Documento público</p>
        <h1>Contrato, Termos de Uso e Política de Privacidade</h1>
        <p className="lead">
          Uma versão clara para clientes e barbearias entenderem como o KorteBarber funciona,
          quais dados são tratados e quais regras valem ao criar conta, agendar, pagar ou usar assinaturas.
        </p>
        <div className="hero-meta">
          <span>Última atualização: {updatedAt}</span>
          <span>Aplicável ao app cliente, app admin e sistema web</span>
        </div>
      </section>

      <section className="summary" aria-label="Resumo rápido">
        <article>
          <strong>Cliente</strong>
          <span>Agenda, paga, avalia e gerencia seus dados com segurança.</span>
        </article>
        <article>
          <strong>Barbearia</strong>
          <span>Configura serviços, profissionais, agenda, políticas e pagamentos.</span>
        </article>
        <article>
          <strong>KorteBarber</strong>
          <span>Fornece a plataforma, integrações e tecnologia de gestão.</span>
        </article>
      </section>

      <section className="content-grid">
        <aside className="toc" aria-label="Índice">
          <p>Índice</p>
          {sections.map((section) => (
            <a key={section.title} href={`#${slug(section.title)}`}>{section.title}</a>
          ))}
        </aside>

        <div className="document">
          <div className="notice">
            <strong>Importante:</strong> este documento é uma base operacional para o produto.
            Antes de uso comercial definitivo, revise com um profissional jurídico para adequar CNPJ,
            endereço, canal oficial de suporte, encarregado de dados e regras específicas da empresa.
          </div>
          {sections.map((section) => (
            <article key={section.title} id={slug(section.title)}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}

          <article id="contato">
            <h2>13. Contato e solicitações</h2>
            <p>
              Para dúvidas, suporte, correção de dados ou solicitações de privacidade, entre em contato
              pelo canal oficial informado no app ou pelo e-mail <a href="mailto:suporte@kortebarber.com.br">suporte@kortebarber.com.br</a>.
            </p>
            <p>
              Consulte também informações públicas da Autoridade Nacional de Proteção de Dados em{' '}
              <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noreferrer">gov.br/anpd</a>.
            </p>
          </article>
        </div>
      </section>

      <style>{`
        .contracts-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 0%, rgba(9,104,255,0.34), transparent 34%),
            radial-gradient(circle at 90% 12%, rgba(111,182,255,0.18), transparent 30%),
            linear-gradient(180deg, #061943 0%, #070b14 44%, #05070d 100%);
          color: #f8fafc;
          font-family: var(--font-geist-sans), Inter, Segoe UI, sans-serif;
          padding: 24px;
        }
        .contracts-nav {
          width: min(1180px, 100%);
          margin: 0 auto 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }
        .brand, .nav-actions a {
          color: inherit;
          text-decoration: none;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          letter-spacing: -0.03em;
          font-size: 20px;
        }
        .brand-mark {
          width: 42px;
          height: 42px;
          display: inline-grid;
          place-items: center;
          border-radius: 14px;
          background: linear-gradient(145deg, #0b72ff, #0537bd);
          box-shadow: 0 16px 34px rgba(9,104,255,0.3);
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #cbd5e1;
          font-size: 14px;
        }
        .nav-actions a {
          padding: 12px 14px;
          border-radius: 999px;
        }
        .nav-actions .cta {
          color: #061943;
          background: #ffffff;
          font-weight: 800;
        }
        .hero {
          width: min(980px, 100%);
          margin: 0 auto 28px;
          text-align: center;
        }
        .eyebrow {
          display: inline-flex;
          margin: 0 0 16px;
          padding: 9px 14px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 999px;
          color: #93c5fd;
          background: rgba(255,255,255,0.06);
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .12em;
        }
        h1 {
          margin: 0;
          font-size: clamp(38px, 7vw, 82px);
          line-height: .95;
          letter-spacing: -0.07em;
        }
        .lead {
          width: min(780px, 100%);
          margin: 24px auto 0;
          color: #cbd5e1;
          font-size: clamp(17px, 2.2vw, 22px);
          line-height: 1.6;
        }
        .hero-meta {
          margin-top: 26px;
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .hero-meta span, .notice {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.07);
          backdrop-filter: blur(16px);
        }
        .hero-meta span {
          padding: 10px 14px;
          border-radius: 999px;
          color: #e2e8f0;
          font-size: 13px;
        }
        .summary {
          width: min(1180px, 100%);
          margin: 34px auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .summary article, .document, .toc {
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(8,15,30,0.72);
          box-shadow: 0 24px 80px rgba(0,0,0,0.28);
        }
        .summary article {
          min-height: 132px;
          border-radius: 24px;
          padding: 22px;
          display: grid;
          gap: 10px;
        }
        .summary strong {
          font-size: 18px;
        }
        .summary span {
          color: #aab6c9;
          line-height: 1.5;
        }
        .content-grid {
          width: min(1180px, 100%);
          margin: 0 auto 80px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 18px;
          align-items: start;
        }
        .toc {
          position: sticky;
          top: 20px;
          border-radius: 24px;
          padding: 20px;
        }
        .toc p {
          margin: 0 0 12px;
          color: #93c5fd;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          font-size: 12px;
        }
        .toc a {
          display: block;
          padding: 10px 0;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .document {
          border-radius: 28px;
          padding: clamp(22px, 4vw, 46px);
        }
        .notice {
          border-radius: 20px;
          padding: 18px;
          color: #dbeafe;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .document article {
          padding: 28px 0;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .document h2 {
          margin: 0 0 14px;
          font-size: clamp(24px, 3vw, 34px);
          letter-spacing: -0.04em;
        }
        .document p {
          margin: 12px 0 0;
          color: #cbd5e1;
          line-height: 1.8;
          font-size: 16px;
        }
        .document a {
          color: #60a5fa;
          font-weight: 800;
        }
        @media (max-width: 820px) {
          .contracts-page { padding: 18px; }
          .contracts-nav { margin-bottom: 38px; align-items: flex-start; }
          .nav-actions { flex-wrap: wrap; justify-content: flex-end; }
          .summary, .content-grid { grid-template-columns: 1fr; }
          .toc { position: static; }
        }
        @media (max-width: 520px) {
          .contracts-nav { display: grid; }
          .nav-actions { justify-content: flex-start; }
          .nav-actions a:not(.cta) { display: none; }
          .summary article { min-height: auto; }
        }
      `}</style>
    </main>
  )
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}


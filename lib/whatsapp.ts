interface WhatsAppTemplateParam {
  type: 'text'
  text: string
}

interface SendTemplateInput {
  to: string
  templateName: string
  languageCode?: string
  params: WhatsAppTemplateParam[]
}

export function normalizeBrazilPhone(phone?: string | null) {
  const digits = String(phone ?? '').replace(/\D/g, '')

  if (!digits) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`

  return null
}

export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = 'pt_BR',
  params,
}: SendTemplateInput) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v24.0'

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp nao configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.')
  }

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: params,
          },
        ],
      },
    }),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(payload?.error?.message || 'Erro ao enviar WhatsApp.')
  }

  return payload
}

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type Transaction = {
  client: string
  service: string
  barber: string
  value: number
  date: string
  paymentMethod: string
  status: string
}

type ExportFinancePdfProps = {
  businessName: string
  period: string
  totalRevenue: number
  received: number
  pending: number
  canceled: number
  transactions: Transaction[]
}

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

export function exportFinancePdf({
  businessName,
  period,
  totalRevenue,
  received,
  pending,
  canceled,
  transactions,
}: ExportFinancePdfProps) {
  const doc = new jsPDF("p", "mm", "a4")

  doc.setFillColor(10, 15, 30)
  doc.rect(0, 0, 210, 35, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text("Relatório Financeiro", 14, 15)

  doc.setFontSize(10)
  doc.text(businessName, 14, 23)
  doc.text(`Período: ${period}`, 14, 29)

  doc.setTextColor(20, 20, 20)

  const cards = [
    ["Receita total", formatMoney(totalRevenue)],
    ["Recebido", formatMoney(received)],
    ["Pendente", formatMoney(pending)],
    ["Cancelado", formatMoney(canceled)],
  ]

  let x = 14
  cards.forEach(([label, value]) => {
    doc.setDrawColor(220, 220, 220)
    doc.roundedRect(x, 45, 42, 25, 3, 3)

    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(label, x + 4, 54)

    doc.setFontSize(11)
    doc.setTextColor(20, 20, 20)
    doc.text(value, x + 4, 64)

    x += 47
  })

  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text("Transações", 14, 85)

  autoTable(doc, {
    startY: 92,
    head: [["Cliente", "Serviço", "Barbeiro", "Valor", "Data", "Pagamento", "Status"]],
    body: transactions.map((item) => [
      item.client,
      item.service,
      item.barber,
      formatMoney(item.value),
      item.date,
      item.paymentMethod,
      item.status,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [10, 15, 30],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  })

  const fileName = `relatorio-financeiro-${businessName
    .toLowerCase()
    .replace(/\s+/g, "-")}.pdf`

  doc.save(fileName)
}
import jsPDF from 'jspdf'

interface ReceiptItem {
  sno: number
  title: string
  isbn: string
  qty: number
  mrp: number
  discountPct: number
  rate: number
  total: number
}

interface ReceiptData {
  invoiceNo: string
  date: string
  customerName: string
  customerPhone: string
  paymentMode: string
  location: string
  items: ReceiptItem[]
  subtotalMrp: number
  totalDiscount: number
  grandTotal: number
  createdBy: string
}

export function generateReceiptPDF(data: ReceiptData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  const W = 148
  const L = 10   // left margin
  const R = 138  // right margin (W - 10)

  const navy  = [27,  42,  107] as const
  const gold  = [200, 146, 42]  as const
  const white = [255, 255, 255] as const
  const gray  = [110, 110, 110] as const
  const black = [30,  30,  30]  as const
  const light = [242, 243, 246] as const

  // ── Header background (navy, 34 mm tall to fit 3 text lines) ──────────────
  doc.setFillColor(...navy)
  doc.rect(0, 0, W, 34, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...white)
  doc.text('ISLAMIC FOUNDATION TRUST', W / 2, 10, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...white)
  doc.text('138, Perambur High Road, Chennai - 600012', W / 2, 19, { align: 'center' })
  doc.text('Phone: +91-44-2662 4401  |  www.iftchennai.in', W / 2, 27, { align: 'center' })

  // ── Gold title bar (starts 2 mm below navy rect) ──────────────────────────
  let y = 36
  doc.setFillColor(...gold)
  doc.rect(0, y, W, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text('SALES RECEIPT', W / 2, y + 5.5, { align: 'center' })
  y += 13

  // ── Bill meta ─────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`Bill No: ${data.invoiceNo}`, L, y)
  doc.text(`Date: ${data.date}`, R, y, { align: 'right' })
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text(`Customer: ${data.customerName || 'Walk-in Customer'}`, L, y)
  doc.text(`Location: ${data.location}`, R, y, { align: 'right' })
  y += 5

  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, L, y)
    y += 5
  }
  doc.text(`Payment: ${data.paymentMode.toUpperCase()}`, L, y)
  y += 8

  // ── Table columns ─────────────────────────────────────────────────────────
  // #(10) | Title(17→82) | Qty(90) | MRP(107) | Rate(124) | Total(138)
  const COL_TITLE = L + 7   // 17
  const COL_QTY   = 90      // right-aligned
  const COL_MRP   = 108     // right-aligned  (+18 from Qty)
  const COL_RATE  = 123     // right-aligned  (+15 from MRP)
  const COL_TOTAL = R       // 138            (+15 from Rate)
  const TITLE_W   = COL_QTY - COL_TITLE - 3  // ~70 mm

  // ── Table header row ──────────────────────────────────────────────────────
  doc.setFillColor(...light)
  doc.rect(L, y - 1, W - 20, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...navy)
  doc.text('#',      L,         y + 4)
  doc.text('Title',  COL_TITLE, y + 4)
  doc.text('Qty',    COL_QTY,   y + 4, { align: 'right' })
  doc.text('MRP',    COL_MRP,   y + 4, { align: 'right' })
  doc.text('Rate',   COL_RATE,  y + 4, { align: 'right' })
  doc.text('Total',  COL_TOTAL, y + 4, { align: 'right' })
  y += 9

  // ── Items ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  for (const item of data.items) {
    const titleLines = doc.splitTextToSize(item.title, TITLE_W)
    const textH = titleLines.length * 4
    const rowH  = Math.max(textH + (item.isbn ? 4 : 0), 7)

    doc.setTextColor(...black)
    doc.text(String(item.sno), L, y)
    doc.text(titleLines, COL_TITLE, y)

    if (item.isbn) {
      doc.setTextColor(...gray)
      doc.setFontSize(6)
      doc.text(`ISBN: ${item.isbn}`, COL_TITLE, y + textH)
      doc.setFontSize(7.5)
    }

    doc.setTextColor(...black)
    doc.text(String(item.qty),               COL_QTY,   y, { align: 'right' })
    doc.text(`Rs.${item.mrp}`,               COL_MRP,   y, { align: 'right' })
    doc.text(`Rs.${item.rate}`,              COL_RATE,  y, { align: 'right' })
    doc.text(`Rs.${item.total.toFixed(2)}`,  COL_TOTAL, y, { align: 'right' })

    y += rowH + 2
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 210, 210)
  doc.line(L, y, R, y)
  y += 6

  // ── Totals (right-aligned block) ──────────────────────────────────────────
  const TLABEL = 92  // left edge of label text
  doc.setFontSize(8)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text('Subtotal (MRP)', TLABEL, y)
  doc.setTextColor(...black)
  doc.text(`Rs.${data.subtotalMrp.toFixed(2)}`, R, y, { align: 'right' })
  y += 5

  doc.setTextColor(...gray)
  doc.text('Discount', TLABEL, y)
  if (data.totalDiscount > 0) {
    doc.setTextColor(5, 150, 105)
  } else {
    doc.setTextColor(...black)
  }
  doc.text(`-Rs.${data.totalDiscount.toFixed(2)}`, R, y, { align: 'right' })
  y += 6

  // Total paid highlight box
  doc.setFillColor(...light)
  doc.rect(L, y - 2, W - 20, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...navy)
  doc.text('TOTAL PAID', TLABEL, y + 5)
  doc.text(`Rs.${data.grandTotal.toFixed(2)}`, R, y + 5, { align: 'right' })
  y += 15

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220)
  doc.line(L, y, R, y)
  y += 5

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  doc.text('Thank you for your purchase!  |  iftchennai.in', W / 2, y, { align: 'center' })

  doc.save(`IFT_Receipt_${data.invoiceNo}.pdf`)
}

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
  footer?: string
}

export function generateReceiptPDF(data: ReceiptData) {
  // A4 portrait: 210 × 297 mm — gives enough room for all columns
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210
  const L = 10   // left margin
  const R = 195  // right margin  (W - 15)

  const navy  = [27,  42,  107] as const
  const gold  = [200, 146, 42]  as const
  const white = [255, 255, 255] as const
  const gray  = [110, 110, 110] as const
  const black = [30,  30,  30]  as const
  const light = [242, 243, 246] as const

  // ── Header background ──────────────────────────────────────────────────────
  doc.setFillColor(...navy)
  doc.rect(0, 0, W, 36, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...white)
  doc.text('ISLAMIC FOUNDATION TRUST', W / 2, 12, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text('138, Perambur High Road, Chennai - 600012', W / 2, 21, { align: 'center' })
  doc.text('Phone: +91-44-2662 4401  |  www.iftchennai.in',  W / 2, 29, { align: 'center' })

  // ── Gold title bar ────────────────────────────────────────────────────────
  let y = 38
  doc.setFillColor(...gold)
  doc.rect(0, y, W, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...white)
  doc.text('SALES RECEIPT', W / 2, y + 6, { align: 'center' })
  y += 15

  // ── Bill meta ─────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`Bill No: ${data.invoiceNo}`, L, y)
  doc.text(`Date: ${data.date}`, R, y, { align: 'right' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text(`Customer: ${data.customerName || 'Walk-in Customer'}`, L, y)
  doc.text(`Location: ${data.location}`, R, y, { align: 'right' })
  y += 6

  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, L, y)
    y += 6
  }
  doc.text(`Payment: ${data.paymentMode.toUpperCase()}`, L, y)
  y += 10

  // ── Column positions (all numeric columns are right-aligned) ───────────────
  //
  //   #   | Title            | Qty  | MRP  | Rate | Total
  //  x=10 | x=18 (width ~78) | x=100| x=122| x=150| x=195
  //
  // Gap between Rate→Total: 45 mm — safe for "Rs.85500.00" (≈18 mm wide)
  //
  const COL_TITLE = 18
  const COL_QTY   = 100  // right-aligned
  const COL_MRP   = 122  // right-aligned (+22 from Qty)
  const COL_RATE  = 150  // right-aligned (+28 from MRP)
  const COL_TOTAL = R    // right-aligned (+45 from Rate)
  const TITLE_W   = COL_QTY - COL_TITLE - 3  // 79 mm

  // ── Table header row ──────────────────────────────────────────────────────
  doc.setFillColor(...light)
  doc.rect(L, y - 2, R - L, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...navy)
  doc.text('#',      L,         y + 4)
  doc.text('Title',  COL_TITLE, y + 4)
  doc.text('Qty',    COL_QTY,   y + 4, { align: 'right' })
  doc.text('MRP',    COL_MRP,   y + 4, { align: 'right' })
  doc.text('Rate',   COL_RATE,  y + 4, { align: 'right' })
  doc.text('Total',  COL_TOTAL, y + 4, { align: 'right' })
  y += 10

  // ── Items ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  for (const item of data.items) {
    const titleLines = doc.splitTextToSize(item.title, TITLE_W)
    const textH = titleLines.length * 4.5
    const rowH  = Math.max(textH + (item.isbn ? 4.5 : 0), 7)

    doc.setTextColor(...black)
    doc.text(String(item.sno), L, y)
    doc.text(titleLines, COL_TITLE, y)

    if (item.isbn) {
      doc.setTextColor(...gray)
      doc.setFontSize(6.5)
      doc.text(`ISBN: ${item.isbn}`, COL_TITLE, y + textH)
      doc.setFontSize(8)
    }

    doc.setTextColor(...black)
    doc.text(String(item.qty),              COL_QTY,   y, { align: 'right' })
    doc.text(`Rs.${item.mrp}`,              COL_MRP,   y, { align: 'right' })
    doc.text(`Rs.${item.rate}`,             COL_RATE,  y, { align: 'right' })
    doc.text(`Rs.${item.total.toFixed(2)}`, COL_TOTAL, y, { align: 'right' })

    y += rowH + 3
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 210, 210)
  doc.line(L, y, R, y)
  y += 8

  // ── Totals (right block) ──────────────────────────────────────────────────
  const TLABEL = R - 95  // left edge of totals label, 95 mm wide block
  doc.setFontSize(9)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text('Subtotal (MRP)', TLABEL, y)
  doc.setTextColor(...black)
  doc.text(`Rs.${data.subtotalMrp.toFixed(2)}`, R, y, { align: 'right' })
  y += 6

  doc.setTextColor(...gray)
  doc.text('Discount', TLABEL, y)
  if (data.totalDiscount > 0) {
    doc.setTextColor(5, 150, 105)
  } else {
    doc.setTextColor(...black)
  }
  doc.text(`-Rs.${data.totalDiscount.toFixed(2)}`, R, y, { align: 'right' })
  y += 7

  // Total paid highlight
  doc.setFillColor(...light)
  doc.rect(L, y - 2, R - L, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...navy)
  doc.text('TOTAL PAID', TLABEL, y + 6)
  doc.text(`Rs.${data.grandTotal.toFixed(2)}`, R, y + 6, { align: 'right' })
  y += 18

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220)
  doc.line(L, y, R, y)
  y += 6

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  doc.text(data.footer ?? 'Thank you for your purchase!  |  iftchennai.in', W / 2, y, { align: 'center' })

  doc.save(`IFT_Receipt_${data.invoiceNo}.pdf`)
}

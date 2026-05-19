// src/lib/pdf-receipt.ts
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
  const W = 148; let y = 10

  const navy  = [27, 42, 107] as const
  const gold  = [200, 146, 42] as const
  const white = [255, 255, 255] as const
  const gray  = [100, 100, 100] as const
  const black = [30, 30, 30] as const
  const light = [245, 246, 248] as const

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...navy)
  doc.rect(0, 0, W, 26, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...white)
  doc.text('ISLAMIC FOUNDATION TRUST', W / 2, y + 4, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...white)
  doc.text('138, Perambur High Road, Chennai – 600012', W / 2, y + 11, { align: 'center' })
  doc.text('WhatsApp: +91 86680 57596  |  www.iftchennai.in', W / 2, y + 17, { align: 'center' })
  y = 30

  // ── Gold title bar ────────────────────────────────────────────────────────
  doc.setFillColor(...gold)
  doc.rect(0, y, W, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text('SALES RECEIPT', W / 2, y + 5, { align: 'center' })
  y += 11

  // ── Bill meta ─────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`Bill No: ${data.invoiceNo}`, 10, y)
  doc.text(`Date: ${data.date}`, W - 10, y, { align: 'right' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text(`Customer: ${data.customerName || 'Walk-in Customer'}`, 10, y)
  doc.text(`Location: ${data.location}`, W - 10, y, { align: 'right' })
  y += 4
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, 10, y)
    y += 4
  }
  doc.text(`Payment: ${data.paymentMode.toUpperCase()}`, 10, y)
  y += 5

  // ── Table header ──────────────────────────────────────────────────────────
  doc.setFillColor(...light)
  doc.rect(10, y - 2, W - 20, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...navy)
  doc.text('#',      10,      y + 2)
  doc.text('Title',  18,      y + 2)
  doc.text('Qty',    95,      y + 2, { align: 'right' })
  doc.text('MRP',    110,     y + 2, { align: 'right' })
  doc.text('Rate',   124,     y + 2, { align: 'right' })
  doc.text('Total',  W - 10,  y + 2, { align: 'right' })
  y += 7

  // ── Items ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  for (const item of data.items) {
    doc.setTextColor(...black)
    doc.text(String(item.sno), 10, y)

    const titleLines = doc.splitTextToSize(item.title, 65)
    doc.text(titleLines, 18, y)

    if (item.isbn) {
      doc.setTextColor(...gray)
      doc.setFontSize(6.5)
      doc.text(`ISBN: ${item.isbn}`, 18, y + titleLines.length * 3.5)
      doc.setFontSize(7.5)
    }

    doc.setTextColor(...black)
    doc.text(String(item.qty),              95,      y, { align: 'right' })
    doc.text(`₹${item.mrp}`,              110,     y, { align: 'right' })
    doc.text(`₹${item.rate}`,             124,     y, { align: 'right' })
    doc.text(`₹${item.total.toFixed(2)}`, W - 10,  y, { align: 'right' })

    y += Math.max(titleLines.length * 4 + (item.isbn ? 4 : 0), 6) + 1
  }

  y += 6

  // ── Totals — right-side block only ────────────────────────────────────────
  const labelX = 85
  const valueX = W - 10  // 138

  doc.setFontSize(8)

  // Subtotal row
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text('Subtotal (MRP)', labelX, y)
  doc.setTextColor(...black)
  doc.text(`₹${data.subtotalMrp.toFixed(2)}`, valueX, y, { align: 'right' })
  y += 5

  // Discount row (green when > 0)
  doc.setTextColor(...gray)
  doc.text('Discount', labelX, y)
  if (data.totalDiscount > 0) {
    doc.setTextColor(5, 150, 105)
  } else {
    doc.setTextColor(...black)
  }
  doc.text(`-₹${data.totalDiscount.toFixed(2)}`, valueX, y, { align: 'right' })
  y += 5

  // TOTAL PAID
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...navy)
  doc.text('TOTAL PAID', labelX, y)
  doc.text(`₹${data.grandTotal.toFixed(2)}`, valueX, y, { align: 'right' })
  y += 8

  // ── Footer (8mm gap from totals) ──────────────────────────────────────────
  y += 8
  doc.setDrawColor(220, 220, 220)
  doc.line(10, y, W - 10, y)
  y += 5

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  doc.text('May Almighty increase us in knowledge', W / 2, y, { align: 'center' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Thank you for purchasing IFT Publications', W / 2, y, { align: 'center' })
  y += 4

  doc.setFontSize(7)
  doc.text(`Billed by: ${data.createdBy}  |  Ref: ${data.invoiceNo}`, W / 2, y, { align: 'center' })

  doc.save(`IFT_Receipt_${data.invoiceNo}.pdf`)
}

// src/lib/excel-export.ts
import * as XLSX from 'xlsx'

interface SheetConfig {
  name: string
  headers: string[]
  rows: (string | number | null)[][]
  colWidths?: number[]
}

export function exportToExcel(sheets: SheetConfig[], filename: string) {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Column widths
    if (sheet.colWidths) {
      ws['!cols'] = sheet.colWidths.map(w => ({ wch: w }))
    }

    // Header styling (bold)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col })
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: '1B2A6B' } } }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// Pre-built export functions for each report type
export function exportStockReport(data: {
  itemCode: string; isbn: string; title: string; author: string;
  category: string; mrp: number; purchaseRate: number;
  openingStock: number; qtyIn: number; qtySold: number; currentStock: number;
  stockValue: number; location: string
}[]) {
  exportToExcel([{
    name: 'Stock Report',
    headers: ['Item Code','ISBN','Title','Author','Category','Location','MRP (₹)','Purchase Rate (₹)','Opening','In','Sold','Current Stock','Stock Value (₹)'],
    rows: data.map(r => [r.itemCode,r.isbn,r.title,r.author,r.category,r.location,r.mrp,r.purchaseRate,r.openingStock,r.qtyIn,r.qtySold,r.currentStock,r.stockValue]),
    colWidths: [10,18,36,24,18,16,10,14,9,7,7,13,14]
  }], 'IFT_Stock_Report')
}

export function exportSalesReport(data: {
  invoiceNo: string; date: string; customerName: string; customerPhone: string;
  items: number; grossMrp: number; discount: number; netAmount: number;
  paymentMode: string; location: string; createdBy: string
}[]) {
  const totalGross   = data.reduce((a,r) => a + r.grossMrp, 0)
  const totalDisc    = data.reduce((a,r) => a + r.discount, 0)
  const totalNet     = data.reduce((a,r) => a + r.netAmount, 0)

  exportToExcel([{
    name: 'Sales Report',
    headers: ['Bill No','Date','Customer','Phone','Items','Gross MRP (₹)','Discount (₹)','Net Amount (₹)','Payment','Location','Billed By'],
    rows: [
      ...data.map(r => [r.invoiceNo,r.date,r.customerName,r.customerPhone,r.items,r.grossMrp,r.discount,r.netAmount,r.paymentMode,r.location,r.createdBy]),
      ['','','','','TOTAL',totalGross,totalDisc,totalNet,'','','']
    ],
    colWidths: [14,18,22,14,7,14,12,14,10,14,16]
  }], 'IFT_Sales_Report')
}

export function exportPurchaseReport(data: {
  invoiceNo: string; date: string; supplier: string; invoiceRef: string;
  items: number; subtotal: number; transport: number; unloading: number;
  totalAmount: number; paid: number; balance: number; status: string
}[]) {
  exportToExcel([{
    name: 'Purchase Report',
    headers: ['Invoice No','Date','Supplier','Supplier Ref','Items','Subtotal (₹)','Transport (₹)','Unloading (₹)','Total (₹)','Paid (₹)','Balance (₹)','Status'],
    rows: data.map(r => [r.invoiceNo,r.date,r.supplier,r.invoiceRef,r.items,r.subtotal,r.transport,r.unloading,r.totalAmount,r.paid,r.balance,r.status]),
    colWidths: [14,12,22,14,7,13,13,13,13,11,11,10]
  }], 'IFT_Purchase_Report')
}

export function exportOutstandings(
  payables: { supplier: string; invoices: number; outstanding: number }[],
  receivables: { customer: string; phone: string; invoices: number; outstanding: number }[]
) {
  exportToExcel([
    {
      name: 'Amount to Give (Payables)',
      headers: ['Supplier', 'Open Invoices', 'Outstanding (₹)'],
      rows: [
        ...payables.map(r => [r.supplier, r.invoices, r.outstanding]),
        ['TOTAL', payables.reduce((a,r)=>a+r.invoices,0), payables.reduce((a,r)=>a+r.outstanding,0)]
      ],
      colWidths: [28, 14, 18]
    },
    {
      name: 'Amount to Receive (Receivables)',
      headers: ['Customer', 'Phone', 'Open Invoices', 'Outstanding (₹)'],
      rows: [
        ...receivables.map(r => [r.customer, r.phone, r.invoices, r.outstanding]),
        ['TOTAL','', receivables.reduce((a,r)=>a+r.invoices,0), receivables.reduce((a,r)=>a+r.outstanding,0)]
      ],
      colWidths: [28, 16, 14, 18]
    }
  ], 'IFT_Outstandings')
}

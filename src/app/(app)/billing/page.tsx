'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search, Camera, X, Plus, Minus, Trash2,
  ShoppingCart, User, Phone, Loader2, Clock,
  CheckCircle, Printer, MessageCircle,
  Banknote, Smartphone, CreditCard, FileText, Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  saveDraft, loadDraft, clearDraft,
  findByBarcode, syncMaterialsToLocal,
} from '@/lib/local-db'
import { getNextInvoiceNo } from '@/lib/invoice-number'
import { generateReceiptPDF } from '@/lib/pdf-receipt'
import { useAuthStore } from '@/store/auth.store'
import type { PaymentMode } from '@/types/erp'
import {
  getDefaultLocation,
  getAllMaterialsForCache,
  searchMaterialsAction,
  lookupBarcodeAction,
  saveBillAction,
} from './actions'

// ─── Local types ──────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  title: string
  author: string
  isbn: string
  mrp: number
  discountPct: number
  stock: number
}

interface CartItem {
  materialId: string
  title: string
  isbn: string
  qty: number
  mrp: number
  discountPct: number
  discountAmount: number  // per unit
  rate: number            // mrp − discountAmount
  total: number           // rate × qty
  stock: number
}

interface ReceiptData {
  invoiceNo: string
  date: string
  customerName: string
  customerPhone: string
  paymentMode: string
  location: string
  items: {
    sno: number; title: string; isbn: string
    qty: number; mrp: number; discountPct: number; rate: number; total: number
  }[]
  subtotalMrp: number
  totalDiscount: number
  grandTotal: number
  createdBy: string
}

// ─── Payment mode config (stable reference) ───────────────────────────────────

const PAYMENT_MODES: { mode: PaymentMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'cash',   label: 'Cash',   icon: <Banknote size={14} /> },
  { mode: 'upi',    label: 'UPI',    icon: <Smartphone size={14} /> },
  { mode: 'card',   label: 'Card',   icon: <CreditCard size={14} /> },
  { mode: 'cheque', label: 'Cheque', icon: <FileText size={14} /> },
]

// ─── Barcode Scanner overlay ──────────────────────────────────────────────────

function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    let qr: { stop: () => Promise<void> } | null = null

    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        qr = new Html5Qrcode('ift-barcode-cam') as unknown as typeof qr
        await (qr as any).start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 120 }, aspectRatio: 1.7 },
          (code: string) => {
            qr?.stop().catch(() => {})
            onScan(code)
          },
          () => {},
        )
      } catch {
        toast.error('Camera unavailable or permission denied')
        onClose()
      }
    })()

    return () => { qr?.stop().catch(() => {}) }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--ift-navy)' }}
        >
          <div className="flex items-center gap-2 text-white text-sm font-semibold">
            <Camera size={16} />
            Scan Barcode / ISBN
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <div
            id="ift-barcode-cam"
            className="w-full rounded-xl overflow-hidden bg-gray-900"
            style={{ minHeight: 200 }}
          />
          <p className="text-xs text-gray-400 text-center mt-3">
            Point camera at barcode, QR code, or ISBN
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData
  onClose: () => void
}) {
  const openWhatsApp = () => {
    const lines = receipt.items
      .map(i =>
        `  • ${i.title}${i.isbn ? ` (${i.isbn})` : ''}\n    ${i.qty} x Rs.${i.rate.toFixed(2)} = Rs.${i.total.toFixed(2)}`
      )
      .join('\n')

    const msg = [
      '*IFT Sales Receipt*',
      `Bill No: ${receipt.invoiceNo}  |  Date: ${receipt.date}`,
      `Customer: ${receipt.customerName}`,
      receipt.customerPhone ? `Phone: ${receipt.customerPhone}` : '',
      `Payment: ${receipt.paymentMode.toUpperCase()}`,
      '',
      '*Items Purchased:*',
      lines,
      '',
      `Subtotal MRP : Rs.${receipt.subtotalMrp.toFixed(2)}`,
      `Discount      : -Rs.${receipt.totalDiscount.toFixed(2)}`,
      `*Grand Total  : Rs.${receipt.grandTotal.toFixed(2)}*`,
      '',
      '_Jazakumullahu Khayran — Thank you for purchasing IFT Publications_',
      '_Islamic Foundation Trust, Chennai — www.iftchennai.in_',
    ]
      .filter(l => l !== null)
      .join('\n')

    const digits = receipt.customerPhone.replace(/\D/g, '')
    const phone  = digits ? (digits.startsWith('91') ? digits : `91${digits}`) : ''
    const base   = phone ? `https://wa.me/${phone}` : 'https://wa.me/'
    window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <div className="flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Bill Generated!</p>
              <p className="text-blue-200 text-xs">{receipt.invoiceNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Date', receipt.date],
              ['Payment', receipt.paymentMode],
              ['Customer', receipt.customerName],
              receipt.customerPhone ? ['Phone', receipt.customerPhone] : null,
              ['Location', receipt.location],
              ['Billed by', receipt.createdBy],
            ]
              .filter((x): x is string[] => Boolean(x))
              .map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className="font-medium text-gray-800 capitalize">{value}</p>
                </div>
              ))}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Items ({receipt.items.length})
            </p>
            <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {receipt.items.map(item => (
                <div
                  key={item.sno}
                  className="flex items-start justify-between px-3 py-2.5 text-sm"
                >
                  <div className="flex-1 pr-3 min-w-0">
                    <p className="font-medium text-gray-800 leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    {item.isbn && (
                      <p className="text-gray-400 text-xs mt-0.5">ISBN: {item.isbn}</p>
                    )}
                    {item.discountPct > 0 && (
                      <p className="text-emerald-600 text-xs">
                        {item.discountPct}% off  ·  MRP Rs.{item.mrp}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>
                    <p className="text-gray-400 text-xs">
                      {item.qty} × Rs.{item.rate.toFixed(2)}
                    </p>
                    <p className="font-bold text-sm" style={{ color: 'var(--ift-navy)' }}>
                      Rs.{item.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <div style={{ width: 'fit-content', minWidth: '320px', background: 'var(--ift-gold-pale)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '48px', padding: '4px 0', fontSize: '14px', color: '#4B5563' }}>
                <span>Subtotal MRP</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>Rs.{receipt.subtotalMrp.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '48px', padding: '4px 0', fontSize: '14px', color: '#059669' }}>
                <span>Total Discount</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>− Rs.{receipt.totalDiscount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '48px', borderTop: '2px solid #1B2A6B', paddingTop: '8px', marginTop: '4px', fontWeight: 'bold', fontSize: '18px', color: 'var(--ift-navy)', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>
                <span>Grand Total</span>
                <span style={{ textAlign: 'right' }}>Rs.{receipt.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee', fontSize: '12px', color: '#9CA3AF' }}>
            <p>Jazakumullahu Khayran</p>
            <p>Thank you for purchasing IFT Publications</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => generateReceiptPDF(receipt)}
            className="btn-outline flex-1"
          >
            <Printer size={15} />
            Print PDF
          </button>
          <button
            onClick={openWhatsApp}
            className="btn flex-1 text-white font-semibold"
            style={{ background: '#25D366' }}
          >
            <MessageCircle size={15} />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const user     = useAuthStore(s => s.user)
  // Search
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching,   setIsSearching]   = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  // Customer
  const [customerName,  setCustomerName]  = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Payment
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')

  // Scanner
  const [showScanner, setShowScanner] = useState(false)

  // Bill generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [receipt,      setReceipt]      = useState<ReceiptData | null>(null)
  const [showReceipt,  setShowReceipt]  = useState(false)

  // Draft
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [location,  setLocation]  = useState<{ id: string; name: string } | null>(null)

  // Computed
  const subtotalMrp   = cartItems.reduce((s, i) => s + i.mrp * i.qty, 0)
  const totalDiscount = cartItems.reduce((s, i) => s + i.discountAmount * i.qty, 0)
  const grandTotal    = subtotalMrp - totalDiscount

  // ── Init: fetch location + sync materials to local cache + load draft ────
  useEffect(() => {
    ;(async () => {
      // Use server actions — bypass RLS with admin client
      const [loc, mats] = await Promise.all([
        getDefaultLocation(),
        getAllMaterialsForCache(),
      ])

      if (loc) setLocation(loc)

      if (mats.length > 0) {
        await syncMaterialsToLocal(
          mats.map(m => ({ ...m, stock: 0, updatedAt: new Date() }))
        )
      }

      if (user?.id) {
        const draft = await loadDraft(user.id)
        if (draft && draft.items.length > 0) {
          setCartItems(
            draft.items.map(i => ({
              materialId:     i.materialId,
              title:          i.title,
              isbn:           i.isbn,
              qty:            i.qty,
              mrp:            i.mrp,
              discountPct:    i.discountPct,
              discountAmount: i.discountAmount,
              rate:           i.rate,
              total:          i.total,
              stock:          9999,
            }))
          )
          setCustomerName(draft.customerName)
          setCustomerPhone(draft.customerPhone)
          setPaymentMode(draft.paymentMode as PaymentMode)
          setLastSaved(new Date(draft.updatedAt))
          toast('Draft restored', { icon: '📋' })
        }
      }
    })()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft every 30 s ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const timer = setInterval(async () => {
      if (cartItems.length === 0) return
      await saveDraft(user.id, {
        userId:       user.id,
        locationId:   location?.id   ?? '',
        customerName,
        customerPhone,
        paymentMode,
        items: cartItems.map(i => ({
          materialId:    i.materialId,
          title:         i.title,
          isbn:          i.isbn,
          qty:           i.qty,
          mrp:           i.mrp,
          discountPct:   i.discountPct,
          discountAmount: i.discountAmount,
          rate:          i.rate,
          total:         i.total,
        })),
        subtotalMrp,
        totalDiscount,
        grandTotal,
      })
      setLastSaved(new Date())
    }, 30_000)
    return () => clearInterval(timer)
  }, [user?.id, cartItems, customerName, customerPhone, paymentMode, location, subtotalMrp, totalDiscount, grandTotal])

  // ── Debounced search (server action — bypasses RLS) ───────────────────────
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); setShowDropdown(false); return }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const results = await searchMaterialsAction(q)
        setSearchResults(results)
        setShowDropdown(true)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => { clearTimeout(timer); setIsSearching(false) }
  }, [searchQuery])

  // Click-outside closes dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Add to cart ───────────────────────────────────────────────────────────
  const addToCart = useCallback((r: SearchResult) => {
    if (r.stock <= 0) return

    setCartItems(prev => {
      const idx = prev.findIndex(i => i.materialId === r.id)
      if (idx !== -1) {
        if (prev[idx].qty >= r.stock) {
          toast.error(`Only ${r.stock} in stock`)
          return prev
        }
        return prev.map((i, n) =>
          n === idx ? { ...i, qty: i.qty + 1, total: parseFloat((i.rate * (i.qty + 1)).toFixed(2)) } : i
        )
      }
      const da   = parseFloat(((r.mrp * r.discountPct) / 100).toFixed(2))
      const rate = parseFloat((r.mrp - da).toFixed(2))
      return [
        ...prev,
        {
          materialId:    r.id,
          title:         r.title,
          isbn:          r.isbn,
          qty:           1,
          mrp:           r.mrp,
          discountPct:   r.discountPct,
          discountAmount: da,
          rate,
          total:         rate,
          stock:         r.stock,
        },
      ]
    })

    setSearchQuery('')
    setShowDropdown(false)
  }, [])

  // ── Barcode scan handler (server action — bypasses RLS) ──────────────────
  const handleScan = useCallback(
    async (code: string) => {
      setShowScanner(false)
      const tid = toast.loading(`Looking up: ${code}…`)

      try {
        // Check local Dexie cache first for instant response
        const cached = await findByBarcode(code)
        if (cached) {
          // Still need real-time stock — server action handles that
          const result = await lookupBarcodeAction(code)
          const stock  = result?.stock ?? 0
          addToCart({ id: cached.id, title: cached.title, author: cached.author, isbn: cached.isbn, mrp: cached.mrp, discountPct: cached.discountPct, stock })
          toast.success(`Added: ${cached.title}`, { id: tid })
          return
        }

        // Not in local cache — full server action lookup
        const result = await lookupBarcodeAction(code)
        if (!result) { toast.error(`No book found for: ${code}`, { id: tid }); return }

        addToCart(result)
        toast.success(`Added: ${result.title}`, { id: tid })
      } catch {
        toast.error('Scan lookup failed', { id: tid })
      }
    },
    [addToCart]
  )

  // ── Cart mutations ────────────────────────────────────────────────────────
  const updateQty = (materialId: string, delta: number) =>
    setCartItems(prev =>
      prev.map(i => {
        if (i.materialId !== materialId) return i
        const qty = Math.max(1, Math.min(i.stock, i.qty + delta))
        return { ...i, qty, total: parseFloat((i.rate * qty).toFixed(2)) }
      })
    )

  const updateDiscount = (materialId: string, raw: number) =>
    setCartItems(prev =>
      prev.map(i => {
        if (i.materialId !== materialId) return i
        const pct = Math.max(0, Math.min(100, isNaN(raw) ? 0 : raw))
        const da  = parseFloat(((i.mrp * pct) / 100).toFixed(2))
        const rt  = parseFloat((i.mrp - da).toFixed(2))
        return { ...i, discountPct: pct, discountAmount: da, rate: rt, total: parseFloat((rt * i.qty).toFixed(2)) }
      })
    )

  const removeItem = (materialId: string) =>
    setCartItems(prev => prev.filter(i => i.materialId !== materialId))

  // ── Generate bill ─────────────────────────────────────────────────────────
  const generateBill = async () => {
    if (cartItems.length === 0) { toast.error('Cart is empty'); return }
    if (!location) { toast.error('No default location configured'); return }

    setIsGenerating(true)
    try {
      const invoiceNo = await getNextInvoiceNo('sales')
      const now       = new Date()

      // All three DB writes (invoice + items + stock deduction) happen in one
      // server action using the admin client — bypasses RLS on sales_invoices.
      await saveBillAction({
        invoiceNo,
        customerName:   customerName  || null,
        customerPhone:  customerPhone || null,
        locationId:     location.id,
        invoiceDate:    format(now, 'yyyy-MM-dd'),
        subtotalMrp,
        totalDiscount,
        grandTotal,
        paymentMode,
        createdBy:      user?.id ?? null,
        items:          cartItems.map(i => ({
          materialId:    i.materialId,
          title:         i.title,
          isbn:          i.isbn,
          qty:           i.qty,
          mrp:           i.mrp,
          discountPct:   i.discountPct,
          discountAmount: i.discountAmount,
          rate:          i.rate,
          total:         i.total,
        })),
      })

      // Clear local draft
      if (user?.id) await clearDraft(user.id)

      // Show receipt modal
      setReceipt({
        invoiceNo,
        date:          format(now, 'dd/MM/yyyy'),
        customerName:  customerName  || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        paymentMode,
        location:      location.name,
        items:         cartItems.map((item, idx) => ({
          sno:         idx + 1,
          title:       item.title,
          isbn:        item.isbn,
          qty:         item.qty,
          mrp:         item.mrp,
          discountPct: item.discountPct,
          rate:        item.rate,
          total:       item.total,
        })),
        subtotalMrp,
        totalDiscount,
        grandTotal,
        createdBy: user?.full_name ?? 'Staff',
      })
      setShowReceipt(true)

      // Reset cart
      setCartItems([])
      setCustomerName('')
      setCustomerPhone('')
      setPaymentMode('cash')
      setLastSaved(null)

      toast.success(`Bill ${invoiceNo} saved!`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to generate bill')
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* Page heading */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="page-title">New Bill</h2>
          <p className="page-sub mt-0.5">Create a new sales invoice</p>
        </div>
        {lastSaved && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={12} />
            Draft saved {format(lastSaved, 'HH:mm:ss')}
          </div>
        )}
      </div>

      {/* Main two-column layout */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

          {/* Search + scan */}
          <div className="card p-4">
            <div className="flex gap-2" ref={searchWrapRef}>
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  className="input pl-9 pr-3"
                  placeholder="Search by title, author, or ISBN…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                />

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                        <Loader2 size={14} className="animate-spin" /> Searching…
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-400">No books found</div>
                    ) : (
                      searchResults.map(r => {
                        const oos = r.stock <= 0
                        return (
                          <button
                            key={r.id}
                            disabled={oos}
                            onClick={() => addToCart(r)}
                            className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-left transition-colors ${
                              oos
                                ? 'bg-red-50 cursor-not-allowed'
                                : 'hover:bg-[#EEF0FA] cursor-pointer'
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <p className={`font-medium text-sm leading-snug ${oos ? 'text-red-600' : 'text-gray-800'}`}>
                                {r.title}
                                {oos && (
                                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-red-500 bg-red-100 px-1.5 py-0.5 rounded">
                                    OUT OF STOCK
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {r.author}
                                {r.isbn ? ` · ISBN: ${r.isbn}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-bold text-sm ${oos ? 'text-red-500' : ''}`}
                                style={oos ? {} : { color: 'var(--ift-navy)' }}>
                                ₹{r.mrp}
                              </p>
                              <p className={`text-xs ${oos ? 'text-red-400' : 'text-gray-400'}`}>
                                {oos ? 'Out of stock' : `${r.stock} in stock`}
                              </p>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowScanner(true)}
                className="btn-primary px-3 shrink-0"
                title="Scan barcode"
              >
                <Camera size={18} />
              </button>
            </div>
          </div>

          {/* Cart */}
          <div className="card flex-1 p-0 overflow-hidden flex flex-col min-h-0">
            {/* Cart header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} style={{ color: 'var(--ift-navy)' }} />
                <span className="font-semibold text-sm text-gray-700">Cart</span>
                {cartItems.length > 0 && (
                  <span className="badge-blue">{cartItems.length} item{cartItems.length > 1 ? 's' : ''}</span>
                )}
              </div>
              {cartItems.length > 0 && (
                <button
                  onClick={() => { if (window.confirm('Clear the entire cart?')) setCartItems([]) }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Empty state */}
            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300 py-16">
                <ShoppingCart size={44} />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs text-gray-400">Search for a book or scan a barcode to add items</p>
              </div>
            ) : (
              /* Cart table */
              <div className="flex-1 overflow-auto">
                <table className="table-auto-ift">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Title / ISBN</th>
                      <th className="w-32 text-center">Qty</th>
                      <th className="w-20 text-right">MRP</th>
                      <th className="w-28 text-center">Disc %</th>
                      <th className="w-24 text-right">Rate</th>
                      <th className="w-24 text-right">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item, idx) => (
                      <tr key={item.materialId}>
                        <td className="text-gray-400 text-xs">{idx + 1}</td>
                        <td>
                          <p className="font-medium text-gray-800 leading-snug line-clamp-2 text-sm">
                            {item.title}
                          </p>
                          {item.isbn && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.isbn}</p>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQty(item.materialId, -1)}
                              disabled={item.qty <= 1}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-8 text-center font-bold text-sm" style={{ color: 'var(--ift-navy)' }}>
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateQty(item.materialId, +1)}
                              disabled={item.qty >= item.stock}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors"
                              style={{ color: 'var(--ift-navy)' }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="text-right text-gray-500 text-sm">₹{item.mrp}</td>
                        <td>
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.discountPct}
                              onChange={e => updateDiscount(item.materialId, parseFloat(e.target.value))}
                              className="w-16 px-2 py-1 text-center text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                            />
                            <span className="text-gray-400 text-xs">%</span>
                          </div>
                        </td>
                        <td className="text-right text-sm font-medium" style={{ color: 'var(--ift-navy)' }}>
                          ₹{item.rate.toFixed(2)}
                        </td>
                        <td className="text-right text-sm font-bold" style={{ color: 'var(--ift-navy)' }}>
                          ₹{item.total.toFixed(2)}
                        </td>
                        <td>
                          <button
                            onClick={() => removeItem(item.materialId)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-4">

          {/* Customer details */}
          <div className="card space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Customer
            </p>
            <div className="relative">
              <User
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                className="input pl-9"
                placeholder="Customer Name (optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div className="relative">
              <Phone
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="tel"
                className="input pl-9"
                placeholder="Phone Number (optional)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Payment mode */}
          <div className="card space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Payment Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_MODES.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    paymentMode === mode
                      ? 'text-white border-transparent shadow-md'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                  style={paymentMode === mode ? { background: 'var(--ift-navy)' } : {}}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bill summary */}
          <div className="card space-y-3" style={{ background: 'var(--ift-gold-pale)', border: '1px solid #f0e0b8' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Bill Summary
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal MRP</span>
                <span className="font-medium tabular-nums">₹{subtotalMrp.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Total Discount</span>
                <span className="font-medium tabular-nums">− ₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="h-px" style={{ background: '#ddc98a' }} />
              <div
                className="flex justify-between font-bold text-[17px] tabular-nums"
                style={{ color: 'var(--ift-navy)' }}
              >
                <span>Grand Total</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
              {cartItems.length > 0 && (
                <p className="text-xs text-gray-400 text-right">
                  {cartItems.reduce((s, i) => s + i.qty, 0)} book{cartItems.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Generate bill button */}
          <button
            onClick={generateBill}
            disabled={isGenerating || cartItems.length === 0}
            className="btn-gold w-full py-3.5 text-[15px] font-bold rounded-xl shadow-md"
          >
            {isGenerating ? (
              <><Loader2 size={18} className="animate-spin" /> Generating…</>
            ) : (
              <><Receipt size={18} /> Generate Bill</>
            )}
          </button>

          {cartItems.length === 0 && (
            <p className="text-center text-xs text-gray-400 -mt-2">
              Add items to the cart first
            </p>
          )}

          {/* Location badge */}
          {location && (
            <p className="text-center text-xs text-gray-400">
              📍 {location.name}
            </p>
          )}
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showReceipt && receipt && (
        <ReceiptModal
          receipt={receipt}
          onClose={() => { setShowReceipt(false); setReceipt(null) }}
        />
      )}
    </div>
  )
}

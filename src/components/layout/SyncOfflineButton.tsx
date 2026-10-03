'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { getOfflineBills, deleteOfflineBill } from '@/lib/local-db'
import { saveBillAction, getOrgSettingsAction } from '@/app/(app)/billing/actions'
import { getNextInvoiceNo } from '@/lib/invoice-number'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function SyncOfflineButton() {
  const [isOnline, setIsOnline] = useState(true)
  const [offlineCount, setOfflineCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const checkOfflineCount = async () => {
    try {
      const bills = await getOfflineBills()
      setOfflineCount(bills.length)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    checkOfflineCount()
    const interval = setInterval(checkOfflineCount, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('You are currently offline')
      return
    }

    try {
      setIsSyncing(true)
      const bills = await getOfflineBills()

      if (bills.length === 0) {
        toast.success('No offline bills to sync')
        setIsSyncing(false)
        return
      }

      const orgSettings = await getOrgSettingsAction()
      let syncedCount = 0

      for (const bill of bills) {
        try {
          const invoiceNo = await getNextInvoiceNo('sales', orgSettings.invoice_prefix)

          await saveBillAction({
            invoiceNo,
            customerName: bill.customerName || null,
            customerPhone: bill.customerPhone || null,
            locationId: bill.locationId,
            invoiceDate: format(bill.createdAt, 'yyyy-MM-dd'),
            subtotalMrp: bill.subtotalMrp,
            totalDiscount: bill.totalDiscount,
            grandTotal: bill.grandTotal,
            paymentMode: bill.paymentMode,
            createdBy: bill.userId || null,
            items: bill.items,
          })

          if (bill.id) {
            await deleteOfflineBill(bill.id)
            syncedCount++
          }
        } catch (err) {
          console.error('Failed to sync bill:', err)
        }
      }

      if (syncedCount > 0) {
        toast.success(`Successfully synced ${syncedCount} bill(s)`)
        await checkOfflineCount()
      } else {
        toast.error('Failed to sync bills')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error during sync')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mr-2">
      {!isOnline && (
        <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
          <WifiOff size={14} /> Offline
        </span>
      )}

      {offlineCount > 0 && (
        <button
          onClick={handleSync}
          disabled={!isOnline || isSyncing}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            isOnline && !isSyncing
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer'
              : 'bg-gray-100 text-gray-500 cursor-not-allowed'
          }`}
          title={!isOnline ? "Connect to internet to sync" : "Click to sync offline bills"}
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          {offlineCount} Pending Sync
        </button>
      )}
    </div>
  )
}

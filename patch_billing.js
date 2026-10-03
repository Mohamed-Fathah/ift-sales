const fs = require('fs');
const filePath = 'src/app/(app)/billing/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// replace local-db imports
content = content.replace(
  /saveDraft, loadDraft, clearDraft,\n  findByBarcode, syncMaterialsToLocal,\n} from '@\/lib\/local-db'/,
  "saveDraft, loadDraft, clearDraft,\n  findByBarcode, syncMaterialsToLocal,\n  saveOfflineBill, getOfflineBills,\n} from '@/lib/local-db'"
);

const saveOfflineBlock = `
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!isOnline) {
        // Save to offline db
        await saveOfflineBill({
          invoiceNo: "OFFLINE-" + Date.now(), // Will be properly generated when synced
          userId: user?.id || '',
          locationId: location.id,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          paymentMode,
          items: cartItems,
          subtotalMrp,
          totalDiscount,
          grandTotal,
          createdAt: new Date(),
        });
        toast.success('Offline mode: Bill saved locally.');

        // Generate PDF
        try {
          const receiptData = {
            invoiceNo: "OFFLINE",
            date: format(now, 'dd-MMM-yyyy'),
            customerName: customerName || 'Walk-in Customer',
            customerPhone: customerPhone || '',
            paymentMode: paymentMode.toUpperCase(),
            location: location.name,
            items: cartItems.map((item, i) => ({
              sno: i + 1,
              title: item.title,
              isbn: item.isbn,
              qty: item.qty,
              mrp: item.mrp,
              discountPct: item.discountPct,
              rate: item.rate,
              total: item.total,
            })),
            subtotalMrp,
            totalDiscount,
            grandTotal,
            createdBy: user?.full_name || 'Staff',
            footer: orgSettings.receipt_footer || 'Thank you for your business!',
          }
          await generateReceiptPDF(receiptData)
        } catch (pdfErr) {
          console.error('PDF generation error:', pdfErr)
          toast.error('Bill saved locally, but PDF generation failed')
        }

        if (user?.id) await clearDraft(user.id)
        setCartItems([])
        setCustomerName('')
        setCustomerPhone('')
        setPaymentMode('cash')
        setIsSaving(false)
        setShowConfirm(false)
        return;
      }
`;

// Insert the block before `const invoiceNo = await getNextInvoiceNo(...)`
content = content.replace(
  /const invoiceNo = await getNextInvoiceNo\('sales', orgSettings\.invoice_prefix\)/,
  saveOfflineBlock + "\n      const invoiceNo = await getNextInvoiceNo('sales', orgSettings.invoice_prefix)"
);

fs.writeFileSync(filePath, content, 'utf8');

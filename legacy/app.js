// UI State
let currentBillItems = [];
let selectedBookForBill = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pageId = e.currentTarget.dataset.page;
      showPage(pageId);
    });
  });

  // Init Date
  document.getElementById('datetimeDisplay').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });

  // Setup Billing
  document.getElementById('billDate').valueAsDate = new Date();
  
  // Real-time calculations in add book panel
  const calcDiscounts = () => {
    const qty = parseFloat(document.getElementById('addQty').value) || 0;
    const mrp = parseFloat(document.getElementById('addMRP').value) || 0;
    const discount = parseFloat(document.getElementById('addDiscount').value) || 0;
    
    const afterDiscount = mrp - (mrp * (discount / 100));
    document.getElementById('addAfterDiscount').value = afterDiscount.toFixed(2);
  };

  document.getElementById('addQty').addEventListener('input', calcDiscounts);
  document.getElementById('addDiscount').addEventListener('input', calcDiscounts);

  // Search input listeners
  document.getElementById('bookSearch').addEventListener('input', debounce(handleBookSearch, 300));
  
  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
  }

  // Initial render
  showPage('dashboard');
});

// Navigation
function showPage(pageId) {
  // Update Nav Active State
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${pageId}`).classList.add('active');

  // Show corresponding page
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');

  // Update Header Title
  const titles = {
    'dashboard': 'Dashboard',
    'billing': 'New Sale / Bill',
    'sales': 'Sales History',
    'stock': 'Stock Management',
    'books': 'Books Catalog',
    'reports': 'Reports'
  };
  document.getElementById('pageTitle').textContent = titles[pageId];

  // Refresh page data
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'billing') initBilling();
  if (pageId === 'books') loadBooks();
  if (pageId === 'stock') loadStock();
  if (pageId === 'sales') loadSales();
  if (pageId === 'reports') showReport('summary');
}

// ---------------- BILLING LOGIC ---------------- //

function initBilling() {
  document.getElementById('billNo').value = db.generateBillNo();
  renderBillTable();
}

function handleBookSearch(e) {
  const query = e.target.value.trim();
  const resultsDiv = document.getElementById('searchResults');
  
  if (query.length < 2) {
    resultsDiv.style.display = 'none';
    return;
  }

  const books = db.searchBooks(query);
  resultsDiv.innerHTML = '';
  
  if (books.length === 0) {
    resultsDiv.innerHTML = '<div class="search-result-item">No books found.</div>';
  } else {
    books.forEach(book => {
      const isOutOfStock = book.stock <= 0;
      const div = document.createElement('div');
      div.className = `search-result-item ${isOutOfStock ? 'text-danger' : ''}`;
      div.innerHTML = `
        <strong>${book.title}</strong> (ISBN: ${book.isbn})<br/>
        <small>MRP: ₹${book.mrp} | Stock: ${book.stock}</small>
        ${isOutOfStock ? '<small style="float:right; color:red;">OUT OF STOCK</small>' : ''}
      `;
      if (!isOutOfStock) {
        div.onclick = () => selectBookForBill(book);
      } else {
        div.style.cursor = 'not-allowed';
      }
      resultsDiv.appendChild(div);
    });
  }
  resultsDiv.style.display = 'block';
}

function selectBookForBill(book) {
  selectedBookForBill = book;
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('bookSearch').value = book.title;
  
  // Show add panel
  document.getElementById('addBookPanel').style.display = 'block';
  document.getElementById('selectedBookInfo').innerHTML = `
    <strong>${book.title}</strong><br/>
    <small>ISBN: ${book.isbn} | In Stock: ${book.stock}</small>
  `;
  
  document.getElementById('addQty').value = 1;
  document.getElementById('addQty').max = book.stock;
  document.getElementById('addMRP').value = book.mrp;
  document.getElementById('addDiscount').value = 0;
  document.getElementById('addAfterDiscount').value = book.mrp;
}

function clearSearch() {
  document.getElementById('bookSearch').value = '';
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('addBookPanel').style.display = 'none';
  selectedBookForBill = null;
}

function addBookToBill() {
  if (!selectedBookForBill) return;

  const qty = parseInt(document.getElementById('addQty').value);
  if (qty > selectedBookForBill.stock) {
    showToast(`Only ${selectedBookForBill.stock} items in stock!`, 'error');
    return;
  }

  const mrp = parseFloat(document.getElementById('addMRP').value);
  const discount = parseFloat(document.getElementById('addDiscount').value);
  const rate = parseFloat(document.getElementById('addAfterDiscount').value);

  currentBillItems.push({
    id: Date.now().toString(),
    bookId: selectedBookForBill.id,
    isbn: selectedBookForBill.isbn,
    title: selectedBookForBill.title,
    qty: qty,
    mrp: mrp,
    discountPercent: discount,
    rate: rate,
    total: rate * qty
  });

  clearSearch();
  renderBillTable();
  showToast('Book added to bill', 'success');
}

function removeBillItem(id) {
  currentBillItems = currentBillItems.filter(item => item.id !== id);
  renderBillTable();
}

function renderBillTable() {
  const tbody = document.getElementById('billTableBody');
  const emptyRow = document.getElementById('billEmptyRow');
  const totalsDiv = document.getElementById('billTotals');
  
  tbody.innerHTML = '';
  
  if (currentBillItems.length === 0) {
    tbody.appendChild(emptyRow);
    emptyRow.style.display = 'table-row';
    totalsDiv.style.display = 'none';
    document.getElementById('billItemCount').textContent = '0 items';
    return;
  }

  emptyRow.style.display = 'none';
  totalsDiv.style.display = 'block';

  let subtotal = 0;
  let totalDiscountValue = 0;
  let grandTotal = 0;

  currentBillItems.forEach((item, index) => {
    const totalMRP = item.qty * item.mrp;
    const itemTotal = item.qty * item.rate;
    subtotal += totalMRP;
    grandTotal += itemTotal;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.title}</td>
      <td>${item.qty}</td>
      <td>${item.mrp.toFixed(2)}</td>
      <td>${item.discountPercent}%</td>
      <td>${item.rate.toFixed(2)}</td>
      <td>${itemTotal.toFixed(2)}</td>
      <td><button class="btn btn-outline" style="padding:2px 5px; color:var(--danger)" onclick="removeBillItem('${item.id}')">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  totalDiscountValue = subtotal - grandTotal;

  document.getElementById('totalMRP').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('totalDiscount').textContent = `-₹${totalDiscountValue.toFixed(2)}`;
  document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
  document.getElementById('billItemCount').textContent = `${currentBillItems.length} items`;
}

function clearBill() {
  if(confirm("Are you sure you want to clear the current bill?")) {
    currentBillItems = [];
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    renderBillTable();
  }
}

function finalizeBill() {
  if (currentBillItems.length === 0) {
    showToast("Bill is empty!", 'error');
    return;
  }

  const customerName = document.getElementById('customerName').value.trim();
  
  const subtotal = currentBillItems.reduce((acc, item) => acc + (item.mrp * item.qty), 0);
  const grandTotal = currentBillItems.reduce((acc, item) => acc + item.total, 0);

  const saleData = {
    billNo: document.getElementById('billNo').value,
    date: document.getElementById('billDate').value,
    customerName: customerName || 'Walk-in Customer',
    customerPhone: document.getElementById('customerPhone').value,
    paymentMode: document.getElementById('paymentMode').value,
    items: [...currentBillItems],
    subtotal: subtotal,
    discountTotal: subtotal - grandTotal,
    grandTotal: grandTotal,
    timestamp: new Date().toISOString()
  };

  db.addSale(saleData);
  
  showToast("Bill Generated Successfully!", 'success');
  
  // Show Receipt Modal
  generateReceiptHTML(saleData);
  
  // Reset
  currentBillItems = [];
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  initBilling();
}


// ---------------- CATALOG LOGIC ---------------- //
function loadBooks() {
  const tbody = document.getElementById('booksTableBody');
  const books = db.getBooks();
  tbody.innerHTML = '';
  
  if (books.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-bill-msg">No books found.</td></tr>';
    return;
  }

  books.forEach(book => {
    tbody.innerHTML += `
      <tr>
        <td>${book.isbn}</td>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category || '-'}</td>
        <td>₹${book.mrp}</td>
        <td>${book.stock}</td>
        <td>${book.publication || '-'}</td>
        <td>
          <button class="btn btn-outline" style="padding:2px 6px" onclick="editBook('${book.id}')">✏️</button>
        </td>
      </tr>
    `;
  });
}

function filterBooks() {
  const query = document.getElementById('booksSearch').value.toLowerCase();
  const tbody = document.getElementById('booksTableBody');
  const books = db.getBooks().filter(b => 
    b.title.toLowerCase().includes(query) || 
    b.isbn.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query)
  );

  tbody.innerHTML = '';
  books.forEach(book => {
    tbody.innerHTML += `
      <tr>
        <td>${book.isbn}</td>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category || '-'}</td>
        <td>₹${book.mrp}</td>
        <td>${book.stock}</td>
        <td>${book.publication || '-'}</td>
        <td>
          <button class="btn btn-outline" style="padding:2px 6px" onclick="editBook('${book.id}')">✏️</button>
        </td>
      </tr>
    `;
  });
}

function openAddBookModal() {
  document.getElementById('editBookISBN').value = '';
  document.getElementById('bookTitle').value = '';
  document.getElementById('bookISBN').value = '';
  document.getElementById('bookAuthor').value = '';
  document.getElementById('bookCategory').value = '';
  document.getElementById('bookMRP').value = '';
  document.getElementById('bookStock').value = '0';
  document.getElementById('bookPublication').value = 'Islamic Foundation Trust';
  document.getElementById('bookDesc').value = '';
  openModal('modal-addBook');
}

function saveBook() {
  const title = document.getElementById('bookTitle').value.trim();
  const isbn = document.getElementById('bookISBN').value.trim();
  const author = document.getElementById('bookAuthor').value.trim();
  const mrp = parseFloat(document.getElementById('bookMRP').value);
  const stock = parseInt(document.getElementById('bookStock').value);
  
  if(!title || !author || isNaN(mrp) || isNaN(stock)) {
    showToast("Please fill all required fields correctly", "error");
    return;
  }

  const bookData = {
    title, isbn, author, mrp, stock,
    category: document.getElementById('bookCategory').value.trim(),
    publication: document.getElementById('bookPublication').value.trim(),
    desc: document.getElementById('bookDesc').value.trim()
  };

  const editId = document.getElementById('editBookISBN').value;
  if (editId) {
    bookData.id = editId;
    db.updateBook(bookData);
    showToast("Book updated!", "success");
  } else {
    try {
      db.addBook(bookData);
      showToast("Book added!", "success");
    } catch(e) {
      showToast(e.message, "error");
      return;
    }
  }

  closeModal('modal-addBook');
  loadBooks();
  loadStock();
}

function editBook(id) {
  const book = db.getBooks().find(b => b.id === id);
  if(!book) return;
  
  document.getElementById('editBookISBN').value = book.id;
  document.getElementById('bookTitle').value = book.title;
  document.getElementById('bookISBN').value = book.isbn || '';
  document.getElementById('bookAuthor').value = book.author || '';
  document.getElementById('bookCategory').value = book.category || '';
  document.getElementById('bookMRP').value = book.mrp;
  document.getElementById('bookStock').value = book.stock;
  document.getElementById('bookPublication').value = book.publication || '';
  document.getElementById('bookDesc').value = book.desc || '';
  
  openModal('modal-addBook');
}


// ---------------- STOCK LOGIC ---------------- //
function loadStock() {
  const tbody = document.getElementById('stockTableBody');
  const books = db.getBooks();
  
  if (books.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-bill-msg">No books found.</td></tr>';
    return;
  }

  renderStockTable(books);
}

function renderStockTable(books) {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '';
  
  books.forEach(book => {
    let status = '<span style="color:var(--secondary)">In Stock</span>';
    if (book.stock === 0) status = '<span class="out-of-stock-text">Out of Stock</span>';
    else if (book.stock <= 5) status = '<span style="color:var(--warning)">Low Stock</span>';
    
    tbody.innerHTML += `
      <tr>
        <td>${book.isbn}</td>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category || '-'}</td>
        <td>₹${book.mrp}</td>
        <td><strong>${book.stock}</strong></td>
        <td>-</td>
        <td>${status}</td>
        <td>
           <button class="btn btn-outline" style="padding:2px 6px" onclick="openStockUpdateModalFor('${book.id}')">+ Add</button>
        </td>
      </tr>
    `;
  });
}

function filterStock() {
  const query = document.getElementById('stockSearch').value.toLowerCase();
  const filter = document.getElementById('stockFilter').value;
  
  let books = db.getBooks().filter(b => 
    b.title.toLowerCase().includes(query) || 
    (b.isbn && b.isbn.toLowerCase().includes(query)) ||
    (b.author && b.author.toLowerCase().includes(query))
  );

  if (filter === 'instock') books = books.filter(b => b.stock > 0);
  if (filter === 'outofstock') books = books.filter(b => b.stock === 0);
  if (filter === 'lowstock') books = books.filter(b => b.stock > 0 && b.stock <= 5);

  renderStockTable(books);
}

function openStockUpdateModal() {
  const select = document.getElementById('stockUpdateBook');
  select.innerHTML = '<option value="">-- Select a Book --</option>';
  db.getBooks().forEach(b => {
    select.innerHTML += `<option value="${b.id}">${b.title} (${b.isbn})</option>`;
  });
  document.getElementById('stockUpdateQty').value = '';
  document.getElementById('stockUpdateNote').value = '';
  openModal('modal-stockUpdate');
}

function openStockUpdateModalFor(id) {
  openStockUpdateModal();
  document.getElementById('stockUpdateBook').value = id;
}

function applyStockUpdate() {
  const id = document.getElementById('stockUpdateBook').value;
  const action = document.getElementById('stockUpdateAction').value;
  const qty = parseInt(document.getElementById('stockUpdateQty').value);
  
  if (!id || isNaN(qty) || qty < 0) {
    showToast("Invalid inputs", "error");
    return;
  }

  db.updateStock(id, qty, action === 'set');
  showToast("Stock updated successfully", "success");
  closeModal('modal-stockUpdate');
  loadStock();
}


// ---------------- SALES & DASHBOARD ---------------- //
function loadDashboard() {
  const sales = db.getSales();
  const books = db.getBooks();
  
  const today = new Date().toISOString().slice(0,10);
  const todaySales = sales.filter(s => s.date === today);
  
  const rev = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);
  const booksSold = todaySales.reduce((acc, s) => acc + s.items.reduce((sum, i)=>sum+i.qty, 0), 0);
  
  document.getElementById('stat-revenue').textContent = `₹${rev.toFixed(2)}`;
  document.getElementById('stat-bills').textContent = todaySales.length;
  document.getElementById('stat-books-sold').textContent = booksSold;
  
  const lowStock = books.filter(b => b.stock <= 5).length;
  document.getElementById('stat-low-stock').textContent = lowStock;

  // Recent Sales
  const recentList = document.getElementById('recentSalesList');
  if(sales.length === 0) {
    recentList.innerHTML = '<div class="empty-state">No sales recorded yet.</div>';
  } else {
    recentList.innerHTML = '';
    sales.slice().reverse().slice(0, 5).forEach(s => {
      recentList.innerHTML += `
        <div style="padding: 10px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
          <div><strong>${s.billNo}</strong> <br/> <small>${s.customerName}</small></div>
          <div style="text-align:right;"><strong>₹${s.grandTotal.toFixed(2)}</strong> <br/> <small>${s.items.length} items</small></div>
        </div>
      `;
    });
  }
}

function loadSales() {
  const tbody = document.getElementById('salesTableBody');
  const sales = db.getSales();
  
  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-bill-msg">No sales found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  sales.slice().reverse().forEach(sale => {
    tbody.innerHTML += `
      <tr>
        <td>${sale.billNo}</td>
        <td>${sale.date}</td>
        <td>${sale.customerName}</td>
        <td>${sale.customerPhone || '-'}</td>
        <td>${sale.items.length}</td>
        <td>₹${sale.grandTotal.toFixed(2)}</td>
        <td>${sale.paymentMode}</td>
        <td>
          <button class="btn btn-outline" style="padding:2px 6px" onclick="viewReceipt('${sale.id}')">👁 View</button>
        </td>
      </tr>
    `;
  });
}

function viewReceipt(id) {
  const sale = db.getSales().find(s => s.id === id);
  if(sale) {
    generateReceiptHTML(sale);
  }
}


// ---------------- RECEIPT ---------------- //
function generateReceiptHTML(sale) {
  let itemsHtml = '';
  sale.items.forEach((item, index) => {
    itemsHtml += `
      <tr>
        <td style="padding:5px; border-bottom:1px solid #ddd;">${index+1}</td>
        <td style="padding:5px; border-bottom:1px solid #ddd;">${item.title}</td>
        <td style="padding:5px; border-bottom:1px solid #ddd;">${item.qty}</td>
        <td style="padding:5px; border-bottom:1px solid #ddd;">₹${item.mrp.toFixed(2)}</td>
        <td style="padding:5px; border-bottom:1px solid #ddd;">${item.discountPercent}%</td>
        <td style="padding:5px; border-bottom:1px solid #ddd;">₹${item.rate.toFixed(2)}</td>
        <td style="padding:5px; border-bottom:1px solid #ddd; text-align:right;">₹${item.total.toFixed(2)}</td>
      </tr>
    `;
  });

  const html = `
    <div id="printArea" style="padding: 20px; font-family: 'Inter', sans-serif; background:white; color:black;">
      <div style="text-align:center; margin-bottom: 20px;">
        <img src="logo.png" alt="Islamic Foundation Trust" style="max-height: 60px; width: auto; object-fit: contain; margin-bottom: 10px;">
        <h2 style="margin:0;">ISLAMIC FOUNDATION TRUST</h2>
        <p style="margin:5px 0; font-size:12px; color: #444;">
          #138, IFT Lane, Perambur High Road, Chennai – 600012<br>
          📞 044-26624401, +91 99529 64011 | ✉️ fc.iftchennai@gmail.com
        </p>
        <h3 style="margin:10px 0 5px 0;">CASH RECEIPT / INVOICE</h3>
      </div>
      
      <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size: 14px;">
        <div>
          <strong>Bill No:</strong> ${sale.billNo}<br>
          <strong>Date:</strong> ${sale.date}<br>
          <strong>Payment:</strong> ${sale.paymentMode}
        </div>
        <div style="text-align:right;">
          <strong>Name:</strong> ${sale.customerName}<br>
          <strong>Contact:</strong> ${sale.customerPhone || 'N/A'}
        </div>
      </div>
      
      <table style="width:100%; border-collapse: collapse; font-size:14px; margin-bottom:20px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:5px; text-align:left;">S.No</th>
            <th style="padding:5px; text-align:left;">Title</th>
            <th style="padding:5px; text-align:left;">Qty</th>
            <th style="padding:5px; text-align:left;">MRP</th>
            <th style="padding:5px; text-align:left;">Disc%</th>
            <th style="padding:5px; text-align:left;">Rate</th>
            <th style="padding:5px; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div style="display:flex; justify-content:flex-end; font-size:14px;">
        <div style="width: 250px;">
          <div style="display:flex; justify-content:space-between; padding:5px 0;">
            <span>Subtotal:</span>
            <span>₹${sale.subtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:5px 0;">
            <span>Discount:</span>
            <span>-₹${sale.discountTotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid #000; font-weight:bold; font-size:16px;">
            <span>Total:</span>
            <span>₹${sale.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div style="margin-top: 30px; text-align:center; font-size: 12px; color:#555;">
        Thank you for shopping with Islamic Foundation Trust!<br>
        * Books once sold will not be taken back. *
      </div>
      <div style="margin-top: 15px; text-align:center; font-size: 10px; color:#888;">
        All Rights Reserved &copy; 2026 fafacreatives.in
      </div>
    </div>
  `;
  
  document.getElementById('receiptContent').innerHTML = html;
  openModal('modal-receipt');
}

function printReceipt() {
  const content = document.getElementById('printArea').innerHTML;
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Print Receipt</title>');
  printWindow.document.write('<style>body{margin:0;padding:20px;}</style></head><body>');
  printWindow.document.write(content);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
}

function downloadPDF() {
  const element = document.getElementById('printArea');
  const opt = {
    margin:       10,
    filename:     'IFT_Receipt.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
}

function copyShareLink() {
  // In a real cloud app, this would be a link to a receipt on the server.
  // For local mode, we'll just show a success message.
  const dummyLink = window.location.origin + window.location.pathname + "?receiptId=DEMO_ID";
  navigator.clipboard.writeText(dummyLink).then(() => {
    showToast("Receipt Link Copied to Clipboard!", "success");
  }).catch(err => {
    showToast("Failed to copy link", "error");
  });
}

// ---------------- REPORTS LOGIC ---------------- //
function showReport(reportType) {
  // Update Tabs Active State
  document.querySelectorAll('.report-tab').forEach(el => el.classList.remove('active'));
  const tab = document.querySelector(`.report-tab[data-report="${reportType}"]`);
  if(tab) tab.classList.add('active');

  const contentDiv = document.getElementById('reportContent');
  const sales = db.getSales();
  const books = db.getBooks();

  if (reportType === 'summary') {
    const totalRev = sales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalBills = sales.length;
    contentDiv.innerHTML = `
      <h3>Overall Summary</h3>
      <p>Total Revenue: ₹${totalRev.toFixed(2)}</p>
      <p>Total Bills Generated: ${totalBills}</p>
      <p>Total Unique Books in Catalog: ${books.length}</p>
    `;
  } else if (reportType === 'byTitle') {
    const titleSales = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        titleSales[item.title] = (titleSales[item.title] || 0) + item.qty;
      });
    });
    let html = '<h3>Sales by Title</h3><table class="data-table"><thead><tr><th>Title</th><th>Qty Sold</th></tr></thead><tbody>';
    Object.entries(titleSales).sort((a,b) => b[1] - a[1]).forEach(([title, qty]) => {
      html += `<tr><td>${title}</td><td>${qty}</td></tr>`;
    });
    html += '</tbody></table>';
    contentDiv.innerHTML = html;
  } else if (reportType === 'byAuthor') {
    // Collect Author sales
    const authorSales = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        const book = books.find(b => b.isbn === item.isbn || b.id === item.bookId);
        const author = book ? book.author : 'Unknown';
        authorSales[author] = (authorSales[author] || 0) + item.qty;
      });
    });
    let html = '<h3>Sales by Author</h3><table class="data-table"><thead><tr><th>Author</th><th>Qty Sold</th></tr></thead><tbody>';
    Object.entries(authorSales).sort((a,b) => b[1] - a[1]).forEach(([author, qty]) => {
      html += `<tr><td>${author}</td><td>${qty}</td></tr>`;
    });
    html += '</tbody></table>';
    contentDiv.innerHTML = html;
  } else if (reportType === 'byCategory') {
     const catSales = {};
     sales.forEach(s => {
      s.items.forEach(item => {
        const book = books.find(b => b.isbn === item.isbn || b.id === item.bookId);
        const cat = book && book.category ? book.category : 'Uncategorized';
        catSales[cat] = (catSales[cat] || 0) + item.qty;
      });
    });
    let html = '<h3>Sales by Category</h3><table class="data-table"><thead><tr><th>Category</th><th>Qty Sold</th></tr></thead><tbody>';
    Object.entries(catSales).sort((a,b) => b[1] - a[1]).forEach(([cat, qty]) => {
      html += `<tr><td>${cat}</td><td>${qty}</td></tr>`;
    });
    html += '</tbody></table>';
    contentDiv.innerHTML = html;
  } else if (reportType === 'byStock') {
    let html = '<h3>Stock Report</h3><table class="data-table"><thead><tr><th>Title</th><th>In Stock</th></tr></thead><tbody>';
    books.sort((a,b) => a.stock - b.stock).forEach(b => {
      let stockColor = b.stock === 0 ? 'var(--danger)' : b.stock <= 5 ? 'var(--warning)' : 'inherit';
      html += `<tr><td>${b.title}</td><td style="color:${stockColor}; font-weight:bold">${b.stock}</td></tr>`;
    });
    html += '</tbody></table>';
    contentDiv.innerHTML = html;
  }
}


// ---------------- UTILS & MODALS ---------------- //

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(message, type='info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.style.padding = '10px 20px';
  toast.style.marginBottom = '10px';
  toast.style.borderRadius = '4px';
  toast.style.color = 'white';
  toast.style.background = type === 'success' ? 'var(--secondary)' : type === 'error' ? 'var(--danger)' : '#333';
  toast.textContent = message;
  
  // ensure toast container styling
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Open Excel Import Modal
function openExcelImport() {
  openModal('modal-excel');
}

// Handling Excel Upload using SheetJS (XLSX)
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: 'array'});
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);
    
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importPreview').innerHTML = `Found ${json.length} records ready to import.`;
    document.getElementById('importBtn').disabled = false;
    document.getElementById('importBtn').onclick = () => processExcelImport(json);
  };
  reader.readAsArrayBuffer(file);
}

function processExcelImport(data) {
  const overwrite = document.getElementById('overwriteExisting').checked;
  let added = 0;
  let updated = 0;
  
  data.forEach(row => {
    // Map columns (fuzzy matching for common names)
    const title = row['Title'] || row['Name'] || row['Book Name'];
    const isbn = (row['ISBN'] || '').toString();
    const author = row['Author'] || '';
    const mrp = parseFloat(row['MRP'] || row['Price']) || 0;
    const stock = parseInt(row['Stock'] || row['Qty'] || row['Quantity']) || 0;
    const category = row['Category'] || '';
    const publication = row['Publication'] || 'Islamic Foundation Trust';
    
    if (title && mrp) {
      const existing = db.getBooks().find(b => b.isbn === isbn && isbn !== '');
      if (existing && overwrite) {
        db.updateBook({ id: existing.id, title, author, mrp, stock, category, publication });
        updated++;
      } else if (!existing) {
        db.addBook({ title, isbn, author, mrp, stock, category, publication, desc:'' });
        added++;
      }
    }
  });
  
  showToast(`Imported: ${added} added, ${updated} updated.`, 'success');
  closeModal('modal-excel');
  loadBooks();
}

// Export Excel Data
function exportExcel() {
  const books = db.getBooks();
  const sales = db.getSales();
  
  if (books.length === 0) {
    showToast("No books to export!", "warning");
    return;
  }

  // Calculate sales and revenue per book
  const salesData = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const id = item.bookId || item.isbn;
      if (!salesData[id]) {
        salesData[id] = { qty: 0, revenue: 0 };
      }
      salesData[id].qty += item.qty;
      salesData[id].revenue += item.total;
    });
  });

  // Map data to comprehensive format for Excel
  const exportData = books.map(b => {
    const soldQty = salesData[b.id]?.qty || salesData[b.isbn]?.qty || 0;
    const revenue = salesData[b.id]?.revenue || salesData[b.isbn]?.revenue || 0;
    const startingStock = b.stock + soldQty;
    
    return {
      'ISBN': b.isbn || '',
      'Title': b.title,
      'Author': b.author || '',
      'Category': b.category || '',
      'MRP (₹)': b.mrp,
      'Starting Stock': startingStock,
      'Total Sales (Qty)': soldQty,
      'Total Revenue (₹)': revenue.toFixed(2),
      'Current Stock (Left)': b.stock,
      'Publication': b.publication || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Comprehensive_Stock");

  const dateStr = new Date().toISOString().slice(0,10);
  XLSX.writeFile(workbook, `IFT_Comprehensive_Report_${dateStr}.xlsx`);
  
  showToast("Excel Exported Successfully!", "success");
}

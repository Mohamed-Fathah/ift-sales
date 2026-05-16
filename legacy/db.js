const DB_KEYS = {
  BOOKS: 'ift_books',
  SALES: 'ift_sales',
  SETTINGS: 'ift_settings'
};

const db = {
  // --- Books Data ---
  getBooks: function() {
    const data = localStorage.getItem(DB_KEYS.BOOKS);
    return data ? JSON.parse(data) : [];
  },
  
  saveBooks: function(books) {
    localStorage.setItem(DB_KEYS.BOOKS, JSON.stringify(books));
  },

  addBook: function(book) {
    const books = this.getBooks();
    const existing = books.find(b => b.isbn === book.isbn && book.isbn !== '');
    if (existing) {
      throw new Error(`Book with ISBN ${book.isbn} already exists!`);
    }
    // ensure ID
    book.id = book.id || 'B' + Date.now();
    books.push(book);
    this.saveBooks(books);
    return book;
  },

  updateBook: function(updatedBook) {
    const books = this.getBooks();
    const index = books.findIndex(b => b.id === updatedBook.id || b.isbn === updatedBook.isbn);
    if (index !== -1) {
      books[index] = { ...books[index], ...updatedBook };
      this.saveBooks(books);
      return true;
    }
    return false;
  },
  
  deleteBook: function(idOrIsbn) {
    let books = this.getBooks();
    books = books.filter(b => b.id !== idOrIsbn && b.isbn !== idOrIsbn);
    this.saveBooks(books);
  },

  updateStock: function(idOrIsbn, qtyChange, exact = false) {
    const books = this.getBooks();
    const book = books.find(b => b.id === idOrIsbn || b.isbn === idOrIsbn);
    if (book) {
      if (exact) {
        book.stock = parseInt(qtyChange);
      } else {
        book.stock = parseInt(book.stock || 0) + parseInt(qtyChange);
      }
      if (book.stock < 0) book.stock = 0; // prevent negative
      this.saveBooks(books);
      return book;
    }
    return null;
  },

  // --- Sales Data ---
  getSales: function() {
    const data = localStorage.getItem(DB_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },

  saveSales: function(sales) {
    localStorage.setItem(DB_KEYS.SALES, JSON.stringify(sales));
  },

  addSale: function(sale) {
    const sales = this.getSales();
    sale.id = 'INV' + Date.now();
    // Reduce stock for each item sold
    sale.items.forEach(item => {
      this.updateStock(item.bookId || item.isbn, -item.qty);
    });
    sales.push(sale);
    this.saveSales(sales);
    return sale;
  },

  // --- Helpers ---
  searchBooks: function(query) {
    const books = this.getBooks();
    if (!query) return books;
    query = query.toLowerCase();
    return books.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.isbn && b.isbn.toLowerCase().includes(query)) ||
      (b.author && b.author.toLowerCase().includes(query))
    );
  },
  
  generateBillNo: function() {
    const sales = this.getSales();
    const prefix = 'IFT-';
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, ''); // YYMMDD
    const count = (sales.length + 1).toString().padStart(4, '0');
    return `${prefix}${dateStr}-${count}`;
  }
};

// Initialize with some dummy data if empty
function initDb() {
  if (db.getBooks().length === 0) {
    db.saveBooks([
      {
        id: 'B1',
        isbn: '978-81-232-0355-3',
        title: 'Arabic Words for Children',
        author: 'Moulavi M.A. Mohamed Haneefa Manbayee',
        category: 'Children',
        mrp: 65.00,
        stock: 100,
        publication: 'Islamic Foundation Trust',
        desc: ''
      },
      {
        id: 'B2',
        isbn: '978-81-232-0356-0',
        title: 'Stories of the Prophets',
        author: 'Ibn Kathir',
        category: 'History',
        mrp: 250.00,
        stock: 0, // out of stock demo
        publication: 'Islamic Foundation Trust',
        desc: ''
      }
    ]);
  }
}

initDb();

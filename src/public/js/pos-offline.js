document.addEventListener('DOMContentLoaded', () => {
  const barcodeInput = document.getElementById('barcodeInput');
  const btnAdd = document.getElementById('btnAdd');
  let cart = [];

  // Listen for barcode scanner (Enter key)
  barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addToCart(barcodeInput.value);
      barcodeInput.value = '';
    }
  });
  btnAdd.addEventListener('click', () => {
    addToCart(barcodeInput.value);
    barcodeInput.value = '';
  });

  function addToCart(code) {
    if(!code) return;
    // Mock logic: Add dummy item
    cart.push({ name: `SP-${code}`, qty: 1, price: 25000 });
    renderCart();
  }

  function renderCart() {
    const tbody = document.getElementById('posCart');
    const totalEl = document.getElementById('posTotal');
    let total = 0;
    tbody.innerHTML = cart.map(item => {
      total += item.qty * item.price;
      return `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toLocaleString()}đ</td><td>${(item.qty*item.price).toLocaleString()}đ</td><td><button class="btn btn-sm btn-danger">X</button></td></tr>`;
    }).join('');
    totalEl.textContent = total.toLocaleString() + 'đ';
  }

  // Offline/Online status listener
  window.addEventListener('online', () => document.getElementById('sync-status').className = 'badge bg-success');
  window.addEventListener('offline', () => document.getElementById('sync-status').className = 'badge bg-danger');
});
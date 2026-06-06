const posApp = {
    cart: [],
    customer: null,
    paymentMethod: 'TienMat',
    usedPoints: 0,
    
    init() {
        this.renderCart();
        this.bindEvents();
    },
    
    bindEvents() {
        // Payment method selection
        document.querySelectorAll('.pay-method').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pay-method').forEach(b => {
                    b.classList.remove('active', 'border-winmart-dark', 'bg-winmart-dark', 'text-white');
                    b.classList.add('border-gray-200', 'bg-white', 'text-gray-600');
                });
                
                const target = e.currentTarget;
                target.classList.remove('border-gray-200', 'bg-white', 'text-gray-600');
                target.classList.add('active', 'border-winmart-dark', 'bg-winmart-dark', 'text-white');
                this.paymentMethod = target.dataset.method;
                
                // Hiển thị khung nhập tiền khách đưa nếu là Tiền mặt
                const cashCalc = document.getElementById('cashCalculator');
                if (cashCalc) {
                    if (this.paymentMethod === 'TienMat') {
                        cashCalc.style.display = 'block';
                    } else {
                        cashCalc.style.display = 'none';
                        document.getElementById('cashGiven').value = '';
                        document.getElementById('cashChange').textContent = '0đ';
                    }
                }
            });
        });

        // Search input
        const searchInput = document.getElementById('posSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    // For barcode scanners, Enter is usually pressed at the end
                    const keyword = e.target.value.trim();
                    this.searchProducts(keyword);
                }
            });
        }

        // Category Filter
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-btn').forEach(b => {
                    b.classList.remove('bg-winmart-dark', 'text-white', 'active');
                    b.classList.add('bg-white', 'text-gray-600');
                });
                const target = e.currentTarget;
                target.classList.remove('bg-white', 'text-gray-600');
                target.classList.add('bg-winmart-dark', 'text-white', 'active');
                
                this.filterCategory(target.dataset.id);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') { e.preventDefault(); document.getElementById('posSearch').focus(); }
            if (e.key === 'F3') { e.preventDefault(); this.clearCart(); }
            if (e.key === 'F9') { e.preventDefault(); this.processCheckout(); }
        });
    },
    
    addToCart(id, name, price, image, vat = 10, stock = 0) {
        const existing = this.cart.find(item => item.id === id);
        if (existing) {
            if (existing.qty >= stock) {
                alert(`Sản phẩm này chỉ còn ${stock} trong kho!`);
                return;
            }
            existing.qty += 1;
        } else {
            if (stock <= 0) {
                alert('Sản phẩm đã hết hàng!');
                return;
            }
            this.cart.push({ id, name, price, image, qty: 1, vat, stock });
        }
        this.renderCart();
        // Play small click sound or visual feedback here if desired
    },
    
    updateQty(id, delta) {
        const item = this.cart.find(item => item.id === id);
        if (item) {
            if (delta > 0 && item.qty + delta > item.stock) {
                alert(`Sản phẩm này chỉ còn ${item.stock} trong kho!`);
                return;
            }
            item.qty += delta;
            if (item.qty <= 0) {
                this.cart = this.cart.filter(i => i.id !== id);
            }
            this.renderCart();
        }
    },
    
    clearCart() {
        if (this.cart.length === 0) return;
        if (confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) {
            this.cart = [];
            this.renderCart();
        }
    },
    
    renderCart() {
        const container = document.getElementById('posCartItems');
        const countEl = document.getElementById('cartCount');
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');
        
        let html = '';
        let totalQty = 0;
        let subtotal = 0;
        let totalVAT = 0;
        
        if (this.cart.length === 0) {
            html = `
                <div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-50" id="emptyCartMessage">
                    <i data-lucide="shopping-basket" class="w-16 h-16 mb-3"></i>
                    <p class="text-xs font-bold">Giỏ hàng đang trống</p>
                    <p class="text-[10px] mt-1">Quét mã vạch hoặc chọn sản phẩm để thêm</p>
                </div>
            `;
        } else {
            this.cart.forEach(item => {
                const itemTotal = item.qty * item.price;
                totalQty += item.qty;
                subtotal += itemTotal;
                totalVAT += itemTotal * (item.vat / 100);
                
                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name.charAt(0))}&background=f1f5f9&color=94a3b8&size=100`;
                let imgSrc = fallbackUrl;
                if (item.image && item.image !== 'null') {
                    imgSrc = item.image.startsWith('/') || item.image.startsWith('http') ? item.image : `/uploads/${item.image}`;
                }
                
                html += `
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-3 group">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <img src="${imgSrc}" class="w-10 h-10 rounded-lg object-cover bg-gray-50 shrink-0" onerror="this.src='${fallbackUrl}'">
                            <div class="overflow-hidden">
                                <h4 class="text-[11px] font-bold text-winmart-dark truncate">${item.name}</h4>
                                <div class="text-xs font-black text-winmart-red mt-0.5">${Number(item.price).toLocaleString('vi-VN')}đ <span class="text-[9px] text-gray-400 font-normal">(+VAT ${item.vat}%)</span></div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0 ml-2">
                            <button class="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition" onclick="posApp.updateQty('${item.id}', -1)">-</button>
                            <span class="w-6 text-center text-xs font-bold">${item.qty}</span>
                            <button class="w-6 h-6 rounded-md bg-winmart-dark text-white flex items-center justify-center hover:bg-black transition" onclick="posApp.updateQty('${item.id}', 1)">+</button>
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
        if (this.cart.length === 0 && window.lucide) {
            lucide.createIcons();
        }
        
        countEl.textContent = totalQty;
        subtotalEl.textContent = Number(subtotal).toLocaleString('vi-VN') + 'đ';
        
        const vatEl = document.getElementById('cartVAT');
        if (vatEl) vatEl.textContent = Number(totalVAT).toLocaleString('vi-VN') + 'đ';
        
        const discountEl = document.getElementById('cartDiscount');
        if (discountEl) discountEl.textContent = '-' + Number(this.usedPoints).toLocaleString('vi-VN') + 'đ';

        const finalTotal = Math.max(0, subtotal + totalVAT - this.usedPoints);
        totalEl.textContent = Number(finalTotal).toLocaleString('vi-VN') + 'đ';
        totalEl.dataset.total = finalTotal;
        
        this.calculateChange();
        this.updateGridStockUI();
    },
    
    updateGridStockUI() {
        // Reset all visible stocks to their base data-stock first
        document.querySelectorAll('[id^="product-stock-"]').forEach(el => {
            const baseStock = parseInt(el.getAttribute('data-stock'), 10) || 0;
            el.textContent = `Kho: ${baseStock}`;
            
            const card = el.closest('.bg-white');
            if (card && baseStock > 0) {
                card.classList.remove('bg-gray-50/50', 'opacity-50');
            }
        });

        // Then subtract cart quantities
        this.cart.forEach(item => {
            const stockEl = document.getElementById(`product-stock-${item.id}`);
            if (stockEl) {
                const baseStock = parseInt(stockEl.getAttribute('data-stock'), 10) || 0;
                const remaining = baseStock - item.qty;
                stockEl.textContent = `Kho: ${remaining}`;
                
                // Trực quan: làm mờ card nếu hết hàng tạm
                if (remaining <= 0) {
                    const card = stockEl.closest('.bg-white');
                    if (card) card.classList.add('bg-gray-50/50', 'opacity-50');
                }
            }
        });
    },

    async searchProducts(keyword) {
        // Implement API call to /api/pos/products?keyword=
        // For now, if barcode matches perfectly, we can auto-add it.
        try {
            const res = await fetch(`/staff/api/pos/products?keyword=${encodeURIComponent(keyword)}`);
            const data = await res.json();
            if (data.success && data.products) {
                if (data.products.length === 1 && /^\d+$/.test(keyword)) {
                    // Exact barcode match, add directly
                    const p = data.products[0];
                    this.addToCart(p.SanPhamId, p.TenSanPham, p.GiaBan, p.HinhAnh, p.ThueVAT !== null ? p.ThueVAT : 10, p.TongTonKho);
                    document.getElementById('posSearch').value = ''; // clear input
                } else {
                    this.renderProductGrid(data.products);
                }
            }
        } catch (e) {
            console.error('Lỗi tìm kiếm', e);
        }
    },

    async filterCategory(categoryId) {
        try {
            const res = await fetch(`/staff/api/pos/products?categoryId=${categoryId}`);
            const data = await res.json();
            if (data.success && data.products) {
                this.renderProductGrid(data.products);
            }
        } catch (e) {
            console.error('Lỗi lọc danh mục', e);
        }
    },

    renderProductGrid(products) {
        const grid = document.getElementById('posProductGrid');
        if (products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center text-gray-400">
                    <i data-lucide="package-open" class="w-12 h-12 mx-auto mb-3 opacity-20"></i>
                    <p class="text-sm font-semibold">Không tìm thấy sản phẩm nào</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let html = '';
        products.forEach(p => {
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.TenSanPham.charAt(0))}&background=f1f5f9&color=94a3b8&size=200&font-size=0.4`;
            let imgSrc = fallbackUrl;
            if (p.HinhAnh) {
                imgSrc = p.HinhAnh.startsWith('/') || p.HinhAnh.startsWith('http') ? p.HinhAnh : `/uploads/${p.HinhAnh}`;
            }
            html += `
                <div class="bg-white rounded-xl p-1.5 sm:p-2 cursor-pointer hover:-translate-y-0.5 transition-all group flex flex-col border border-gray-100 shadow-sm hover:shadow hover:border-winmart-red/30 h-full" 
                     onclick="posApp.addToCart('${p.SanPhamId}', '${p.TenSanPham.replace(/'/g, "\\'")}', ${p.GiaBan}, '${p.HinhAnh || ''}', ${p.ThueVAT !== null ? p.ThueVAT : 10}, ${p.TongTonKho})">
                    <div class="aspect-square bg-gray-50 rounded-lg mb-1.5 overflow-hidden flex items-center justify-center relative">
                        <img src="${imgSrc}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null; this.src='${fallbackUrl}'">
                        <span id="product-stock-${p.SanPhamId}" data-stock="${p.TongTonKho}" class="absolute top-1 right-1 bg-white/90 backdrop-blur-sm text-[9px] font-black px-1 py-0.5 rounded text-winmart-dark shadow-sm">Kho: ${p.TongTonKho}</span>
                    </div>
                    <div class="flex-1 flex flex-col">
                        <h3 class="text-[10px] sm:text-[11px] font-bold text-gray-700 line-clamp-2 leading-tight mb-1 group-hover:text-winmart-red transition-colors">${p.TenSanPham}</h3>
                        <div class="mt-auto">
                            <span class="text-[11px] sm:text-xs font-black text-winmart-red">${Number(p.GiaBan).toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
        lucide.createIcons();
    },

    calculateChange() {
        const cashGivenInput = document.getElementById('cashGiven');
        const cashChangeEl = document.getElementById('cashChange');
        
        if (!cashGivenInput || !cashChangeEl) return;

        // Xóa các ký tự không phải số
        let rawValue = cashGivenInput.value.replace(/\D/g, '');
        if (rawValue === '') rawValue = '0';
        
        // Format lại input thành tiền tệ để dễ nhìn
        const numericValue = parseInt(rawValue, 10);
        if (numericValue > 0) {
            cashGivenInput.value = numericValue.toLocaleString('vi-VN');
        } else {
            cashGivenInput.value = '';
        }

        // Tính tổng tiền hiện tại của giỏ hàng
        let subtotal = 0;
        let totalVAT = 0;
        this.cart.forEach(item => {
            const itemTotal = item.qty * item.price;
            subtotal += itemTotal;
            totalVAT += itemTotal * (item.vat / 100);
        });
        
        const total = Math.max(0, subtotal + totalVAT - this.usedPoints); 
        
        const change = numericValue - total;
        
        if (numericValue === 0) {
            cashChangeEl.textContent = '0đ';
            cashChangeEl.classList.remove('text-emerald-600', 'text-red-500');
            cashChangeEl.classList.add('text-winmart-dark');
        } else if (change >= 0) {
            cashChangeEl.textContent = Number(change).toLocaleString('vi-VN') + 'đ';
            cashChangeEl.classList.remove('text-red-500', 'text-winmart-dark');
            cashChangeEl.classList.add('text-emerald-600');
        } else {
            cashChangeEl.textContent = 'Thiếu ' + Number(Math.abs(change)).toLocaleString('vi-VN') + 'đ';
            cashChangeEl.classList.remove('text-emerald-600', 'text-winmart-dark');
            cashChangeEl.classList.add('text-red-500');
        }
    },
    
    showDiscountModal() {
        if (!this.customer) {
            alert('Vui lòng chọn khách hàng để sử dụng điểm!');
            return;
        }
        if (!this.customer.TongDiemTichLuy || this.customer.TongDiemTichLuy <= 0) {
            alert('Khách hàng chưa có điểm tích lũy!');
            return;
        }
        
        const maxPoints = Math.floor(parseInt(document.getElementById('cartTotal').dataset.total || 0) * 0.5);
        const maxUsable = Math.min(this.customer.TongDiemTichLuy, maxPoints);
        
        if (maxUsable <= 0) {
            alert('Đơn hàng không đủ điều kiện sử dụng điểm (tối đa 50% đơn hàng)!');
            return;
        }

        const pts = prompt(`Khách hàng có ${this.customer.TongDiemTichLuy} điểm (Tối đa sử dụng: ${maxUsable} điểm).\nNhập số điểm muốn sử dụng:`, "0");
        if (pts !== null) {
            const parsed = parseInt(pts.replace(/\D/g, ''), 10);
            if (!isNaN(parsed) && parsed >= 0) {
                if (parsed > maxUsable) {
                    alert(`Số điểm sử dụng vượt mức cho phép (${maxUsable})!`);
                    return;
                }
                this.usedPoints = parsed;
                this.renderCart();
            }
        }
    },

    async processCheckout() {
        if (this.cart.length === 0) {
            alert('Giỏ hàng đang trống!');
            return;
        }

        const totalEl = document.getElementById('cartTotal');
        const finalTotal = parseInt(totalEl.dataset.total || 0);

        if (this.paymentMethod === 'TienMat') {
            const cashGivenInput = document.getElementById('cashGiven');
            const numericCash = parseInt((cashGivenInput.value || '').replace(/\D/g, ''), 10) || 0;
            if (numericCash < finalTotal) {
                alert(`Khách đưa không đủ! Khách cần trả: ${Number(finalTotal).toLocaleString('vi-VN')}đ`);
                cashGivenInput.focus();
                return;
            }
        }

        const payload = {
            cartItems: this.cart,
            phuongThucTT: this.paymentMethod,
            khachHangId: this.customer ? this.customer.KhachHangId : null,
            diemSuDung: this.usedPoints
        };

        try {
            // Show loading state
            const btn = document.querySelector('button[onclick="posApp.processCheckout()"]');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Đang xử lý...';
            btn.disabled = true;

            const res = await fetch('/staff/api/pos/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            lucide.createIcons();

            if (data.success) {
                // Tự động mở tab in hóa đơn
                if (data.order && data.order.hoaDonId) {
                    window.open(`/staff/orders/${data.order.hoaDonId}/print`, '_blank');
                } else {
                    alert(`Thanh toán thành công! Mã hóa đơn: ${data.order.maHoaDon}`);
                }
                
                this.cart = [];
                this.customer = null;
                this.setCustomer(null);
                
                // Reset Tiền khách đưa và Điểm
                this.usedPoints = 0;
                const cashGivenInput = document.getElementById('cashGiven');
                const cashChangeEl = document.getElementById('cashChange');
                if (cashGivenInput) cashGivenInput.value = '';
                if (cashChangeEl) cashChangeEl.textContent = '0đ';
                
                this.renderCart();
                
                // Refresh real stock by reloading products grid
                const searchInput = document.getElementById('posSearch');
                if (searchInput && searchInput.value) {
                    this.searchProducts(searchInput.value);
                } else {
                    const activeCat = document.querySelector('#posCategoryFilter .cat-btn.active');
                    if (activeCat) {
                        this.filterCategory(activeCat.dataset.id);
                    }
                }
            } else {
                alert(data.message || 'Lỗi thanh toán');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ!');
            console.error(e);
        }
    },
    
    showCustomerModal() {
        const modal = document.getElementById('customerModal');
        const content = document.getElementById('customerModalContent');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Slight delay for animation
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
        
        document.getElementById('customerSearchPhone').focus();
    },

    closeCustomerModal() {
        const modal = document.getElementById('customerModal');
        const content = document.getElementById('customerModalContent');
        
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            
            // Reset modal state
            document.getElementById('customerSearchPhone').value = '';
            document.getElementById('customerSearchMsg').classList.add('hidden');
            document.getElementById('customerResultArea').classList.add('hidden');
            document.getElementById('customerRegisterForm').classList.add('hidden');
        }, 300);
    },

    async searchCustomer() {
        const phone = document.getElementById('customerSearchPhone').value.trim();
        if (!phone) return;
        
        const btn = document.querySelector('button[onclick="posApp.searchCustomer()"]');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
        
        try {
            const res = await fetch(`/staff/api/pos/customers/search?phone=${phone}`);
            const data = await res.json();
            
            btn.innerHTML = originalHtml;
            lucide.createIcons();

            if (data.success && data.customer) {
                // Show Result
                document.getElementById('customerSearchMsg').classList.add('hidden');
                document.getElementById('customerRegisterForm').classList.add('hidden');
                
                document.getElementById('foundCustomerName').textContent = data.customer.HoTen;
                document.getElementById('foundCustomerPoints').textContent = data.customer.TongDiemTichLuy || 0;
                document.getElementById('foundCustomerTier').textContent = data.customer.CapDoVIP || 'THUONG';
                
                // Store temp found customer
                this._tempCustomer = data.customer;
                
                document.getElementById('customerResultArea').classList.remove('hidden');
            } else {
                // Not found -> Show register form
                document.getElementById('customerResultArea').classList.add('hidden');
                document.getElementById('customerSearchMsg').classList.remove('hidden');
                
                const regForm = document.getElementById('customerRegisterForm');
                regForm.classList.remove('hidden');
                document.getElementById('regCustomerPhone').value = phone;
                document.getElementById('regCustomerName').focus();
            }
        } catch (e) {
            btn.innerHTML = originalHtml;
            lucide.createIcons();
            alert('Lỗi tìm kiếm khách hàng');
        }
    },

    selectFoundCustomer() {
        if (this._tempCustomer) {
            this.setCustomer(this._tempCustomer);
            this.closeCustomerModal();
        }
    },

    async registerCustomer() {
        const name = document.getElementById('regCustomerName').value.trim();
        const phone = document.getElementById('regCustomerPhone').value.trim();
        
        if (!name || !phone) {
            alert('Vui lòng nhập tên và số điện thoại');
            return;
        }

        const btn = document.querySelector('button[onclick="posApp.registerCustomer()"]');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ĐANG XỬ LÝ...';

        try {
            const res = await fetch('/staff/api/pos/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ HoTen: name, SoDienThoai: phone })
            });
            const data = await res.json();
            
            btn.innerHTML = originalHtml;
            lucide.createIcons();

            if (data.success && data.customer) {
                this.setCustomer(data.customer);
                this.closeCustomerModal();
            } else {
                alert(data.message || 'Lỗi đăng ký');
            }
        } catch (e) {
            btn.innerHTML = originalHtml;
            lucide.createIcons();
            alert('Lỗi kết nối máy chủ');
        }
    },

    setCustomer(customer) {
        this.customer = customer;
        const nameEl = document.getElementById('selectedCustomerName');
        const phoneEl = document.getElementById('selectedCustomerPhone');
        
        if (customer) {
            nameEl.textContent = customer.HoTen;
            nameEl.classList.add('text-winmart-red');
            phoneEl.textContent = `Hạng: ${customer.CapDoVIP} | Điểm: ${customer.TongDiemTichLuy || 0}`;
        } else {
            nameEl.textContent = 'Khách vãng lai';
            nameEl.classList.remove('text-winmart-red');
            phoneEl.textContent = 'Không tích điểm';
            this.usedPoints = 0;
        }
        this.renderCart();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    posApp.init();
});

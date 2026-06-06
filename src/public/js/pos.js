/**
 * POS Application Logic - WinMart
 * Handles Cart State, Checkout, Customer Search, and UI Interactions
 */

const posApp = {
    cart: [],
    customer: null,
    discount: 0,
    usedPoints: 0,
    paymentMethod: 'TienMat',
    cashGiven: 0,
    
    init() {
        // Force empty cart on init (page load) to prevent ghost data
        this.cart = [];
        this.setupEventListeners();
        this.renderCart();
    },

    // ==========================================
    // 1. CART MANAGEMENT
    // ==========================================


    addToCart(id, name, price, img, vat = 10, stock = 0) {
        if (stock <= 0) {
            showAdminToast('Sản phẩm đã hết hàng!', 'error');
            return;
        }

        const existing = this.cart.find(item => item.id === id);
        if (existing) {
            if (existing.qty >= stock) {
                showAdminToast('Không đủ tồn kho!', 'error');
                return;
            }
            existing.qty += 1;
        } else {
            this.cart.unshift({
                id,
                name,
                price: parseFloat(price),
                img,
                qty: 1,
                vat: parseFloat(vat) || 10,
                maxStock: parseInt(stock) || 999
            });
        }
        
        this.renderCart();
        
        // Play small sound or show tiny toast (optional)
        showAdminToast('Đã thêm: ' + name, 'success');
    },

    updateQty(id, change) {
        const index = this.cart.findIndex(item => item.id === id);
        if (index === -1) return;

        const item = this.cart[index];
        const newQty = item.qty + change;

        if (newQty <= 0) {
            this.cart.splice(index, 1);
        } else if (newQty > item.maxStock) {
            showAdminToast('Vượt quá tồn kho!', 'error');
            return;
        } else {
            item.qty = newQty;
        }

        this.renderCart();
    },

    removeItem(id) {
        this.cart = this.cart.filter(item => item.id !== id);
        this.renderCart();
    },

    clearCart() {
        if (this.cart.length === 0) return;
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng? (F3)')) {
            this.cart = [];
            this.customer = null;
            this.discount = 0;
            this.usedPoints = 0;
            this.cashGiven = 0;
            document.getElementById('cashGiven').value = '';
            this.updateCustomerUI();
            this.renderCart();
        }
    },

    // ==========================================
    // 2. RENDER UI & CALCULATIONS
    // ==========================================

    renderCart() {
        const container = document.getElementById('posCartItems');
        const countEl = document.getElementById('cartCount');
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');
        const discountEl = document.getElementById('cartDiscount');
        const vatEl = document.getElementById('cartVAT');

        let subtotal = 0;
        let totalItems = 0;
        let totalVAT = 0;

        let html = '';

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
                const itemTotal = item.price * item.qty;
                subtotal += itemTotal;
                totalItems += item.qty;
                totalVAT += itemTotal * ((item.vat || 10) / 100);

                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name.charAt(0))}&background=f1f5f9&color=94a3b8`;
                let imgSrc = fallbackUrl;
                if (item.img && item.img !== 'null') {
                    imgSrc = (item.img.startsWith('/') || item.img.startsWith('http')) ? item.img : '/uploads/' + item.img;
                }

                html += `
                    <div class="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 group animate-fade-in">
                        <div class="w-12 h-12 rounded-lg bg-gray-50 shrink-0 overflow-hidden border border-gray-200">
                            <img src="${imgSrc}" class="w-full h-full object-cover" onerror="this.src='${fallbackUrl}'">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-xs font-bold text-gray-700 line-clamp-2 leading-tight mb-1">${item.name}</h4>
                            <div class="text-[11px] font-black text-winmart-red">${item.price.toLocaleString('vi-VN')}đ <span class="text-[9px] text-gray-400 font-normal">(+VAT ${item.vat || 10}%)</span></div>
                        </div>
                        <div class="flex flex-col items-end gap-2 shrink-0">
                            <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition" onclick="posApp.updateQty('${item.id}', -1)">-</button>
                                <div class="w-6 text-center text-xs font-bold">${item.qty}</div>
                                <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition" onclick="posApp.updateQty('${item.id}', 1)">+</button>
                            </div>
                            <button class="text-red-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100" onclick="posApp.removeItem('${item.id}')">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
        if (this.cart.length === 0 && window.lucide) {
            lucide.createIcons();
        } else if (window.lucide) {
            lucide.createIcons();
        }

        const totalDiscount = this.usedPoints + (this.promoDiscount || 0);
        const total = Math.max(0, subtotal + totalVAT - totalDiscount);

        if (countEl) countEl.textContent = totalItems;
        if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('vi-VN') + 'đ';
        if (vatEl) vatEl.textContent = totalVAT.toLocaleString('vi-VN') + 'đ';
        if (discountEl) discountEl.textContent = '-' + totalDiscount.toLocaleString('vi-VN') + 'đ';
        if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN') + 'đ';
        if (totalEl) totalEl.dataset.total = total;
        
        this.cartTotal = total; // Save for checkout
        this.prePointsTotal = subtotal + totalVAT - (this.promoDiscount || 0);
        this.calculateChange(); // Re-calc change if total updates
        this.updateGridStockUI();
    },

    updateGridStockUI() {
        document.querySelectorAll('[id^="product-stock-"]').forEach(el => {
            const baseStock = parseInt(el.getAttribute('data-stock'), 10) || 0;
            el.textContent = `Kho: ${baseStock}`;
            
            const card = el.closest('.bg-white');
            if (card && baseStock > 0) {
                card.classList.remove('bg-gray-50/50', 'opacity-50');
            }
        });

        this.cart.forEach(item => {
            const stockEl = document.getElementById(`product-stock-${item.id}`);
            if (stockEl) {
                const baseStock = parseInt(stockEl.getAttribute('data-stock'), 10) || 0;
                const remaining = baseStock - item.qty;
                stockEl.textContent = `Kho: ${remaining}`;
                
                if (remaining <= 0) {
                    const card = stockEl.closest('.bg-white');
                    if (card) card.classList.add('bg-gray-50/50', 'opacity-50');
                }
            }
        });
    },

    calculateChange() {
        const input = document.getElementById('cashGiven');
        if (!input) return;

        // Strip non-numeric
        let val = input.value.replace(/[^0-9]/g, '');
        if (!val) val = '0';
        
        this.cashGiven = parseInt(val, 10);
        
        // Re-format input as money
        if (this.cashGiven > 0) {
            input.value = this.cashGiven.toLocaleString('vi-VN');
        } else {
            input.value = '';
        }

        const changeEl = document.getElementById('cashChange');
        if (this.cashGiven >= this.cartTotal && this.cartTotal > 0) {
            const change = this.cashGiven - this.cartTotal;
            changeEl.textContent = change.toLocaleString('vi-VN') + 'đ';
            changeEl.className = 'text-xs font-black text-emerald-600';
        } else {
            changeEl.textContent = '0đ';
            changeEl.className = 'text-xs font-black text-gray-400';
        }
    },

    setPaymentMethod(method) {
        this.paymentMethod = method;
        document.querySelectorAll('.pay-method').forEach(btn => {
            if (btn.dataset.method === method) {
                btn.classList.add('active', 'border-winmart-dark', 'bg-winmart-dark', 'text-white');
                btn.classList.remove('border-gray-200', 'bg-white', 'text-gray-600');
            } else {
                btn.classList.remove('active', 'border-winmart-dark', 'bg-winmart-dark', 'text-white');
                btn.classList.add('border-gray-200', 'bg-white', 'text-gray-600');
            }
        });

        const cashBox = document.getElementById('cashCalculator');
        if (method === 'TienMat') {
            cashBox.style.display = 'block';
        } else {
            cashBox.style.display = 'none';
        }
    },

    // ==========================================
    // 3. CUSTOMER MANAGEMENT
    // ==========================================

    showCustomerModal() {
        const modal = document.getElementById('customerModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById('customerModalContent').classList.remove('scale-95');
            document.getElementById('customerSearchPhone').focus();
        }, 10);
    },

    closeCustomerModal() {
        const modal = document.getElementById('customerModal');
        modal.classList.add('opacity-0');
        document.getElementById('customerModalContent').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    },

    async searchCustomer() {
        const phone = document.getElementById('customerSearchPhone').value;
        const msg = document.getElementById('customerSearchMsg');
        const resArea = document.getElementById('customerResultArea');
        const regForm = document.getElementById('customerRegisterForm');

        if (!phone) {
            msg.textContent = 'Vui lòng nhập số điện thoại!';
            msg.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch(`/staff/api/pos/customers/search?phone=${phone}`);
            const data = await response.json();

            if (data.success) {
                msg.classList.add('hidden');
                regForm.classList.add('hidden');
                resArea.classList.remove('hidden');
                
                this.tempCustomer = data.customer;
                document.getElementById('foundCustomerName').textContent = data.customer.HoTen;
                document.getElementById('foundCustomerPoints').textContent = data.customer.TongDiemTichLuy || 0;
                document.getElementById('foundCustomerTier').textContent = data.customer.CapDoVIP || 'Đồng';
            } else {
                msg.textContent = data.message;
                msg.classList.remove('hidden');
                resArea.classList.add('hidden');
                regForm.classList.remove('hidden');
                document.getElementById('regCustomerPhone').value = phone;
            }
        } catch (e) {
            console.error(e);
            msg.textContent = 'Lỗi kết nối!';
            msg.classList.remove('hidden');
        }
    },

    selectFoundCustomer() {
        if (!this.tempCustomer) return;
        this.customer = this.tempCustomer;
        this.updateCustomerUI();
        this.closeCustomerModal();
        showAdminToast('Đã chọn khách hàng: ' + this.customer.HoTen, 'success');
    },

    async registerCustomer() {
        const name = document.getElementById('regCustomerName').value;
        const phone = document.getElementById('regCustomerPhone').value;

        if (!name || !phone) {
            showAdminToast('Vui lòng nhập đủ thông tin', 'error');
            return;
        }

        try {
            const res = await fetch('/staff/api/pos/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ HoTen: name, SoDienThoai: phone })
            });
            const data = await res.json();
            
            if (data.success) {
                this.customer = data.customer;
                this.updateCustomerUI();
                this.closeCustomerModal();
                showAdminToast('Đăng ký thẻ thành viên thành công!', 'success');
            } else {
                showAdminToast(data.message, 'error');
            }
        } catch (e) {
            showAdminToast('Lỗi kết nối', 'error');
        }
    },

    updateCustomerUI() {
        const nameEl = document.getElementById('selectedCustomerName');
        const detailEl = document.getElementById('selectedCustomerPhone');
        
        if (this.customer) {
            nameEl.textContent = this.customer.HoTen;
            detailEl.textContent = `${this.customer.SoDienThoai} | Điểm: ${this.customer.TongDiemTichLuy || 0}`;
        } else {
            nameEl.textContent = 'Khách vãng lai';
            detailEl.textContent = 'Không tích điểm';
        }
    },

    showDiscountModal() {
        const modal = document.getElementById('discountModal');
        
        if (this.customer) {
            const maxPoints = Math.floor(this.prePointsTotal * 0.5);
            const maxUsable = Math.min(this.customer.TongDiemTichLuy || 0, maxPoints);
            // Display total accumulated points
            document.getElementById('maxAvailablePoints').textContent = (this.customer.TongDiemTichLuy || 0).toLocaleString('vi-VN');
            document.getElementById('pointsInput').max = maxUsable;
            document.getElementById('pointsInput').placeholder = `Tối đa: ${maxUsable}`;
        } else {
            document.getElementById('maxAvailablePoints').textContent = '0 (Cần khách hàng)';
            document.getElementById('pointsInput').max = 0;
            document.getElementById('pointsInput').placeholder = "0";
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById('discountModalContent').classList.remove('scale-95');
        }, 10);
    },

    closeDiscountModal() {
        const modal = document.getElementById('discountModal');
        if (!modal) return;
        modal.classList.add('opacity-0');
        document.getElementById('discountModalContent').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    },

    async applyPromoCode() {
        const codeInput = document.getElementById('promoCodeInput').value.trim().toUpperCase();
        const msgEl = document.getElementById('promoCodeMsg');
        msgEl.classList.remove('hidden');

        if (!codeInput) {
            this.promoCode = null;
            this.promoDiscount = 0;
            this.renderCart();
            msgEl.textContent = 'Đã hủy mã giảm giá';
            msgEl.className = 'text-[10px] font-bold mt-1 text-gray-500';
            return;
        }

        const orderTotalPreDiscount = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0); // Simplified total
        
        try {
            const res = await fetch('/staff/api/pos/validate-promo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    maCode: codeInput, 
                    orderTotal: orderTotalPreDiscount,
                    khachHangId: this.customer ? this.customer.KhachHangId : null
                })
            });
            const data = await res.json();
            
            if (data.success) {
                this.promoCode = codeInput;
                this.promoDiscount = data.discountValue;
                this.renderCart();
                msgEl.textContent = data.message;
                msgEl.className = 'text-[10px] font-bold mt-1 text-emerald-500';
            } else {
                this.promoCode = null;
                this.promoDiscount = 0;
                this.renderCart();
                msgEl.textContent = data.message;
                msgEl.className = 'text-[10px] font-bold mt-1 text-red-500';
            }
        } catch (e) {
            msgEl.textContent = 'Lỗi kiểm tra mã giảm giá';
            msgEl.className = 'text-[10px] font-bold mt-1 text-red-500';
        }
    },

    applyPoints() {
        if (!this.customer) {
            showAdminToast('Vui lòng chọn khách hàng để sử dụng điểm!', 'error');
            return;
        }
        
        const maxPoints = Math.floor(this.prePointsTotal * 0.5);
        const maxUsable = Math.min(this.customer.TongDiemTichLuy || 0, maxPoints);
        
        const inputVal = document.getElementById('pointsInput').value;
        const pts = parseInt(inputVal, 10) || 0;
        
        if (pts > maxUsable) {
            showAdminToast(`Chỉ được dùng tối đa ${maxUsable} điểm cho đơn này!`, 'error');
            return;
        }
        
        this.usedPoints = pts;
        this.renderCart();
        showAdminToast(`Áp dụng thành công ${pts} điểm!`, 'success');
        this.closeDiscountModal();
    },

    // ==========================================
    // 4. CHECKOUT
    // ==========================================

    async processCheckout() {
        if (this.cart.length === 0) {
            showAdminToast('Giỏ hàng trống!', 'error');
            return;
        }

        const totalEl = document.getElementById('cartTotal');
        const finalTotal = parseInt(totalEl ? totalEl.dataset.total || 0 : this.cartTotal);

        if (this.paymentMethod === 'TienMat') {
            if (this.cashGiven < finalTotal) {
                showAdminToast(`Khách chưa đưa đủ tiền! Cần thêm ${(finalTotal - this.cashGiven).toLocaleString('vi-VN')}đ`, 'error');
                return;
            }
            // Proceed immediately for Cash
            this.executeCheckoutAPI();
        } else if (this.paymentMethod === 'ChuyenKhoan') {
            // Show standard QR Modal for Bank/QR (Manual verification)
            this.showQRModal(finalTotal, 'ChuyenKhoan');
        } else if (this.paymentMethod === 'VNPayMoMo') {
            // Show QR Modal for VNPay / MoMo (Dynamic generation)
            this.showQRModal(finalTotal, 'VNPayMoMo');
        }
    },

    showQRModal(amount, type) {
        const modal = document.getElementById('qrModal');
        const title = document.getElementById('qrModalTitle');
        const amountDisplay = document.getElementById('qrAmountDisplay');
        const qrImage = document.getElementById('qrImage');
        const skeleton = document.getElementById('qrSkeleton');
        const generatorOptions = document.getElementById('qrGeneratorOptions');
        const displayArea = document.getElementById('qrDisplayArea');
        const btnManualConfirm = document.getElementById('btnManualConfirmQR');

        amountDisplay.textContent = amount.toLocaleString('vi-VN') + 'đ';

        if (type === 'ChuyenKhoan') {
            title.textContent = 'Thanh toán Chuyển khoản';
            generatorOptions.style.display = 'none';
            displayArea.style.display = 'flex';
            btnManualConfirm.classList.remove('hidden'); // Show manual confirm button

            // VietQR logic for manual transfer
            const bankName = 'MB';
            const accountNo = '0347465650';
            let transferContent = 'Thanh toan don hang ';
            if (this.customer && this.customer.SoDienThoai) {
                transferContent += this.customer.SoDienThoai;
            } else {
                transferContent += new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            }
            
            const safeContent = encodeURIComponent(transferContent.replace(/ /g, ''));
            const qrUrl = `https://img.vietqr.io/image/${bankName}-${accountNo}-compact2.png?amount=${amount}&addInfo=${safeContent}&accountName=WINMART`;

            qrImage.classList.add('hidden');
            skeleton.classList.remove('hidden');
            
            qrImage.onload = () => {
                skeleton.classList.add('hidden');
                qrImage.classList.remove('hidden');
            };
            qrImage.src = qrUrl;

        } else if (type === 'VNPayMoMo') {
            title.textContent = 'Thanh toán VNPay / MoMo';
            generatorOptions.style.display = 'grid'; // Show VNPay/MoMo selection
            displayArea.style.display = 'none'; // Hide QR until generated
            btnManualConfirm.classList.add('hidden'); // Hide manual confirm
            this.currentOrderCode = null;
        }

        // Show Modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById('qrModalContent').classList.remove('scale-95');
        }, 10);
    },

    async generateDynamicQR(provider) {
        const generatorOptions = document.getElementById('qrGeneratorOptions');
        const displayArea = document.getElementById('qrDisplayArea');
        const providerText = document.getElementById('qrProviderText');
        const skeleton = document.getElementById('qrSkeleton');
        const qrImage = document.getElementById('qrImage');

        generatorOptions.style.display = 'none';
        displayArea.style.display = 'flex';
        providerText.textContent = `Mã quét QR ${provider}`;
        qrImage.classList.add('hidden');
        skeleton.classList.remove('hidden');
        
        // Execute Checkout API to get PayURL from Backend
        this.paymentMethod = provider; // Set temporary to VNPay or MoMo
        const payload = {
            cartItems: this.cart,
            phuongThucTT: provider,
            khachHangId: this.customer ? this.customer.KhachHangId : null,
            maGiamGia: this.promoCode,
            diemSuDung: this.usedPoints
        };

        try {
            const res = await fetch('/staff/api/pos/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.success && data.redirectUrl) {
                this.currentOrderCode = data.order.MaHoaDon || data.order.maHoaDon;
                // Encode redirect URL into QR Code
                const encodedUrl = encodeURIComponent(data.redirectUrl);
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedUrl}`;
                
                qrImage.onload = () => {
                    skeleton.classList.add('hidden');
                    qrImage.classList.remove('hidden');
                };
                qrImage.src = qrUrl;

                // Start Polling for Payment Status
                this.startPaymentPolling(this.currentOrderCode, data.order);
            } else {
                showAdminToast('Lỗi tạo cổng thanh toán!', 'error');
                this.closeQRModal();
            }
        } catch (e) {
            console.error(e);
            showAdminToast('Lỗi kết nối máy chủ!', 'error');
            this.closeQRModal();
        }
    },

    startPaymentPolling(orderCode, orderObj) {
        if (this.paymentPollingInterval) {
            clearInterval(this.paymentPollingInterval);
        }
        
        // Poll every 3 seconds
        this.paymentPollingInterval = setInterval(async () => {
            if (!document.getElementById('qrModal').classList.contains('flex')) {
                clearInterval(this.paymentPollingInterval); // Stop if modal closed
                return;
            }
            try {
                const res = await fetch(`/staff/api/pos/check-payment/${orderCode}`);
                const data = await res.json();
                if (data.success && data.isPaid) {
                    clearInterval(this.paymentPollingInterval);
                    this.closeQRModal();
                    showAdminToast('Khách hàng thanh toán thành công!', 'success');
                    
                    // Finalize POS state
                    this.printReceipt(orderObj);
                    this.cart = [];
                    this.customer = null;
                    this.cashGiven = 0;
                    this.usedPoints = 0;
                    this.promoCode = null;
                    this.promoDiscount = 0;
                    document.getElementById('cashGiven').value = '';
                    this.updateCustomerUI();
                    this.renderCart();
                    setTimeout(() => window.location.reload(), 3000);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 3000);
    },

    closeQRModal() {
        const modal = document.getElementById('qrModal');
        if (!modal) return;
        if (this.paymentPollingInterval) {
            clearInterval(this.paymentPollingInterval);
        }
        modal.classList.add('opacity-0');
        document.getElementById('qrModalContent').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    },

    confirmQRPayment() {
        console.log("confirmQRPayment called");
        try {
            // Customer paid via QR, proceed to execute API
            this.closeQRModal();
            this.executeCheckoutAPI();
        } catch (e) {
            console.error("Error in confirmQRPayment:", e);
            if (typeof showAdminToast === 'function') {
                showAdminToast('Lỗi xử lý thanh toán', 'error');
            }
        }
    },

    async executeCheckoutAPI() {
        const payload = {
            cartItems: this.cart,
            phuongThucTT: this.paymentMethod,
            khachHangId: this.customer ? this.customer.KhachHangId : null,
            maGiamGia: this.promoCode,
            diemSuDung: this.usedPoints
        };

        try {
            const res = await fetch('/staff/api/pos/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            
            if (data.success) {
                showAdminToast('Thanh toán thành công! Mã đơn: ' + data.order.maHoaDon, 'success');
                // In Bill
                this.printReceipt(data.order);
                // Clear cart
                this.cart = [];
                this.customer = null;
                this.cashGiven = 0;
                this.usedPoints = 0;
                this.promoCode = null;
                this.promoDiscount = 0;
                document.getElementById('cashGiven').value = '';
                this.updateCustomerUI();
                this.renderCart();
                
                // Refresh product grid to sync real stock from server after toast finishes
                const searchInput = document.getElementById('posSearch');
                if (searchInput && searchInput.value) {
                    // Trigger simple refresh or rely on API reload
                    setTimeout(() => window.location.reload(), 3000);
                } else {
                    setTimeout(() => window.location.reload(), 3000);
                }
            } else {
                showAdminToast(data.message || 'Lỗi thanh toán', 'error');
            }
        } catch (e) {
            console.error(e);

            showAdminToast('Không thể kết nối tới máy chủ', 'error');
        }
    },

    printReceipt(order) {
        if (!order || !order.hoaDonId) return;
        const printWin = window.open(`/staff/orders/${order.hoaDonId}/print`, '_blank', 'width=400,height=600');
        if (!printWin) {
            if (typeof showAdminToast === 'function') {
                showAdminToast('Vui lòng cho phép mở popup để in hóa đơn', 'error');
            }
        }
    },

    // ==========================================
    // 5. EVENT LISTENERS & SHORTCUTS
    // ==========================================

    setupEventListeners() {
        // Payment method buttons
        document.querySelectorAll('.pay-method').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setPaymentMethod(e.currentTarget.dataset.method);
            });
        });

        // Search Product Filter (Simple JS filter)
        const searchInput = document.getElementById('posSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const keyword = e.target.value.toLowerCase();
                document.querySelectorAll('#posProductGrid > div').forEach(card => {
                    const name = card.querySelector('h3').textContent.toLowerCase();
                    const sku = card.querySelector('.text-gray-400').textContent.toLowerCase();
                    if (name.includes(keyword) || sku.includes(keyword)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // Global Shortcuts
        document.addEventListener('keydown', (e) => {
            // F1: Focus Search
            if (e.key === 'F1') {
                e.preventDefault();
                document.getElementById('posSearch').focus();
            }
            // F3: Clear Cart
            if (e.key === 'F3') {
                e.preventDefault();
                this.clearCart();
            }
            // F9: Checkout
            if (e.key === 'F9') {
                e.preventDefault();
                this.processCheckout();
            }
        });

        // Barcode Scanner Logic
        let barcodeString = '';
        let barcodeTimeout;
        document.addEventListener('keypress', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                if (barcodeString.length >= 5) {
                    // It's a barcode!
                    const barcode = barcodeString;
                    // Find product in DOM by SKU
                    const cards = document.querySelectorAll('#posProductGrid > div');
                    let found = false;
                    cards.forEach(card => {
                        const sku = card.querySelector('.text-gray-400').textContent.trim();
                        if (sku === barcode) {
                            card.click();
                            found = true;
                        }
                    });
                    if (!found) showAdminToast('Không tìm thấy sản phẩm mã: ' + barcode, 'error');
                }
                barcodeString = '';
            } else {
                barcodeString += e.key;
                clearTimeout(barcodeTimeout);
                barcodeTimeout = setTimeout(() => { barcodeString = ''; }, 50); // Fast typing threshold
            }
        });
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    posApp.init();
});

const db = require('../../config/db');

exports.index = async (req, res) => {
    const cart = req.session.cart || [];
    
    if (cart.length === 0) {
        req.flash('error', 'Giỏ hàng của bạn đang trống.');
        return res.redirect('/cart');
    }

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalVat = cart.reduce((sum, item) => sum + (item.price * item.quantity * ((item.vat || 0) / 100)), 0);
    
    // Check if cart has fresh food (DanhMucId = 4)
    let hasFreshFood = false;
    if (cart.length > 0) {
        const productIds = cart.map(item => item.productId);
        try {
            const [rows] = await db.pool.query(
                `SELECT DanhMucId FROM SanPham WHERE SanPhamId IN (?) AND DanhMucId = 4 LIMIT 1`,
                [productIds]
            );
            if (rows.length > 0) {
                hasFreshFood = true;
            }
        } catch (error) {
            console.error("Lỗi kiểm tra danh mục sản phẩm tươi sống:", error);
        }
    }

    let cuaHangs = [];
    let store = {};
    try {
        const [storeRows] = await db.pool.query(`SELECT * FROM CuaHang WHERE is_active = 1`);
        cuaHangs = storeRows;
        store = storeRows[0] || {};
    } catch (error) {
        console.error("Lỗi lấy danh sách cửa hàng:", error);
    }

    res.render('client/checkout/index', {
        title: 'Thanh toán',
        cart: cart,
        totalAmount: totalAmount,
        totalVat: totalVat,
        hasFreshFood: hasFreshFood,
        cuaHangs: cuaHangs,
        store: store,
        activePage: 'checkout'
    });
};

exports.process = async (req, res) => {
    const { 
        fullName, phone, address, paymentMethod, note, shippingFee, distance, cuaHangId, maGiamGia,
        toProvinceId, toDistrictId, toWardCode 
    } = req.body;
    const cart = req.session.cart || [];

    if (cart.length === 0) {
        return res.json({ success: false, message: 'Giỏ hàng của bạn đang trống.' });
    }

    const connection = await db.pool.getConnection();
    try {
        await connection.beginTransaction();

        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalVat = cart.reduce((sum, item) => sum + (item.price * item.quantity * ((item.vat || 0) / 100)), 0);
        
        // Re-calculate shipping fee securely on backend
        const [storeRows] = await connection.query('SELECT * FROM CuaHang WHERE is_active = 1 LIMIT 1');
        const storeConfig = storeRows[0];
        if (!storeConfig) {
            throw new Error('Không tìm thấy cấu hình cửa hàng.');
        }

        const productIds = cart.map(item => item.productId);
        const [products] = await connection.query(
            `SELECT SanPhamId, DanhMucId, CanNang, CanDongGoiDacBiet, GiaBan, ThueVAT FROM SanPham WHERE SanPhamId IN (?)`,
            [productIds]
        );

        let totalWeight = 0;
        let specialPackagingCount = 0;
        let freshFoodValue = 0;
        let cartSubtotal = 0;

        cart.forEach(item => {
            const product = products.find(p => p.SanPhamId.toString() === item.productId.toString());
            if (product) {
                const weight = product.CanNang || 500;
                totalWeight += weight * item.quantity;

                if (product.CanDongGoiDacBiet) {
                    specialPackagingCount += item.quantity;
                }

                if (product.DanhMucId === 4) {
                    freshFoodValue += product.GiaBan * item.quantity;
                }

                const vatMultiplier = 1 + ((product.ThueVAT || 0) / 100);
                cartSubtotal += (product.GiaBan * item.quantity) * vatMultiplier;
            }
        });

        // 1. Gọi GHN API để tính phí nền
        const ghnService = require('../../services/ghn.service');
        let ghnBaseFee = 0;
        if (toDistrictId && toWardCode) {
            try {
                ghnBaseFee = await ghnService.calculateGHNBaseFee(toDistrictId, toWardCode, totalWeight);
            } catch (e) {
                console.error('Lỗi khi tính phí nền GHN ở backend process, sử dụng phí dự phòng 15.000đ:', e.message);
                ghnBaseFee = 15000;
            }
        } else {
            ghnBaseFee = 15000; // Fallback
        }

        // 2. Tính phụ thu hàng tươi sống
        let freshFee = 0;
        if (freshFoodValue > 0) {
            if (freshFoodValue >= storeConfig.FreshTier2Threshold) {
                freshFee = storeConfig.FreshTier2Fee;
            } else {
                freshFee = storeConfig.FreshTier1Fee;
            }
        }

        // 3. Tính phụ thu đóng gói đặc biệt
        const packagingFee = specialPackagingCount * storeConfig.PackagingFee;

        // 4. Tổng chi phí ship
        let finalShippingFee = ghnBaseFee + freshFee + packagingFee;

        // 5. Kiểm tra chính sách miễn phí ship đơn hàng lớn
        if (cartSubtotal >= storeConfig.FreeShipThreshold) {
            finalShippingFee = 0;
        }

        let grandTotal = totalAmount + totalVat + finalShippingFee;

        let finalNote = note || '';
        if (finalShippingFee > 0) {
            finalNote = `[Trọng lượng: ${totalWeight}g - Phí Ship: ${finalShippingFee.toLocaleString('vi-VN')}đ]\n${finalNote}`;
        }
        
        // Determine IDs based on Role
        let KhachHangId = null;
        let NhanVienId = 1; // Default to Admin/System user for online orders

        if (req.session.user) {
            if (req.session.user.role === 'CUSTOMER') {
                KhachHangId = req.session.user.id;
            } else {
                // If an admin or staff places an online order, set them as the NhanVien
                NhanVienId = req.session.user.id;
            }
        }

        // Validate Promotion Code
        let maGiamGiaId = null;
        let tongGiamGia = 0;
        if (maGiamGia) {
            const promotionService = require('../../services/promotion.service');
            try {
                // Validate requires order total before shipping
                const promo = await promotionService.validateCode(maGiamGia, totalAmount, KhachHangId);
                tongGiamGia = promo.discountValue;
                maGiamGiaId = promo.promoId;
                grandTotal -= tongGiamGia;
                if (grandTotal < 0) grandTotal = 0;
                await promotionService.incrementUsage(maGiamGiaId, connection);
            } catch (err) {
                await connection.rollback();
                connection.release();
                return res.json({ success: false, message: `Mã giảm giá không hợp lệ: ${err.message}` });
            }
        }
        
        // Generate Order Code (MaHoaDon)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const MaHoaDon = `HD${dateStr}${randomNum}`;

        // Insert into HoaDonBanHang
        const [orderResult] = await connection.query(
            `INSERT INTO HoaDonBanHang 
            (MaHoaDon, KhachHangId, NhanVienId, PhiShip, MaGiamGiaId, MaLoaiHinh, TongTienTruocKM, TongTienSauKM, PhuongThucTT, LoaiGiao, DiaChiNhan, TenNguoiNhan, SdtNguoiNhan, ToProvinceId, ToDistrictId, ToWardCode, GhiChu) 
            VALUES (?, ?, ?, ?, ?, 'Online', ?, ?, ?, 'Ship', ?, ?, ?, ?, ?, ?, ?)`,
            [
                MaHoaDon, 
                KhachHangId, 
                NhanVienId, 
                finalShippingFee,
                maGiamGiaId,
                totalAmount, 
                grandTotal, 
                paymentMethod || 'TienMat', 
                address, 
                fullName || 'Khách hàng',
                phone || '',
                toProvinceId ? parseInt(toProvinceId, 10) : null,
                toDistrictId ? parseInt(toDistrictId, 10) : null,
                toWardCode || null,
                finalNote.trim()
            ]
        );

        const orderId = orderResult.insertId;

        // Insert into ChiTietHoaDon and Update Stock
        for (const item of cart) {
            // Re-verify stock
            const [productRows] = await connection.query(
                `SELECT SUM(SoLuongHienTai) as TongTonKho FROM LoHangTonKho WHERE SanPhamId = ? AND TrangThai = 'Available' FOR UPDATE`,
                [item.productId]
            );

            if (productRows.length === 0 || productRows[0].TongTonKho === null || productRows[0].TongTonKho < item.quantity) {
                throw new Error(`Sản phẩm ${item.name} không đủ số lượng tồn kho.`);
            }

            const lineTotal = item.price * item.quantity;
            const lineVat = lineTotal * ((item.vat || 0) / 100);
            const lineFinal = lineTotal + lineVat;

            await connection.query(
                `INSERT INTO ChiTietHoaDon (HoaDonId, SanPhamId, SoLuong, DonGiaGoc, ThueVATApDung, ThanhTienCuoi)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [orderId, item.productId, item.quantity, item.price, item.vat || 0, lineFinal]
            );

            // Deduct stock using FEFO (First Expire First Out)
            let remainingToDeduct = item.quantity;
            const [batches] = await connection.query(
                `SELECT LoHangId, SoLuongHienTai FROM LoHangTonKho WHERE SanPhamId = ? AND TrangThai = 'Available' ORDER BY NgayHetHan ASC FOR UPDATE`,
                [item.productId]
            );

            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;

                const deductAmount = Math.min(batch.SoLuongHienTai, remainingToDeduct);
                await connection.query(
                    `UPDATE LoHangTonKho SET SoLuongHienTai = SoLuongHienTai - ?, TrangThai = IF(SoLuongHienTai - ? <= 0, 'SoldOut', TrangThai) WHERE LoHangId = ?`,
                    [deductAmount, deductAmount, batch.LoHangId]
                );
                remainingToDeduct -= deductAmount;
            }
        }

        await connection.commit();

        // Clear cart
        req.session.cart = [];
        req.session.cartCount = 0;

        if (paymentMethod === 'VNPay') {
            const paymentService = require('../../services/payment.service');
            const returnUrl = req.protocol + '://' + req.get('host') + '/checkout/vnpay_return';
            const vnpUrl = paymentService.createVNPayUrl(req, grandTotal, MaHoaDon, returnUrl);
            return res.json({ success: true, message: 'Đang chuyển hướng sang VNPay...', redirectUrl: vnpUrl, orderCode: MaHoaDon });
        } else if (paymentMethod === 'MoMo') {
            const paymentService = require('../../services/payment.service');
            const returnUrl = req.protocol + '://' + req.get('host') + '/checkout/momo_return';
            const ipnUrl = req.protocol + '://' + req.get('host') + '/checkout/momo_ipn'; // IPN actually needs a public domain!
            try {
                const momoUrl = await paymentService.createMoMoUrl(grandTotal, MaHoaDon, returnUrl, ipnUrl);
                return res.json({ success: true, message: 'Đang chuyển hướng sang MoMo...', redirectUrl: momoUrl, orderCode: MaHoaDon });
            } catch (err) {
                return res.json({ success: false, message: 'Lỗi tạo cổng thanh toán MoMo.' });
            }
        } else if (paymentMethod === 'ChuyenKhoan') {
            return res.json({ success: true, message: 'Đang tạo mã thanh toán...', redirectUrl: '/checkout/payment/' + MaHoaDon, orderCode: MaHoaDon });
        } else {
            return res.json({ success: true, message: 'Đặt hàng thành công!', redirectUrl: '/checkout/success?code=' + MaHoaDon, orderCode: MaHoaDon });
        }

    } catch (error) {
        await connection.rollback();
        console.error('Lỗi thanh toán:', error);
        return res.status(500).json({ success: false, message: error.message || 'Đã xảy ra lỗi hệ thống khi thanh toán.' });
    } finally {
        connection.release();
    }
};

exports.success = (req, res) => {
    const orderCode = req.query.code || 'N/A';
    res.render('client/checkout/success', {
        title: 'Đặt hàng thành công',
        user: req.session.user || null,
        cartCount: req.session.cartCount || 0,
        orderCode: orderCode
    });
};

exports.validatePromo = async (req, res) => {
    try {
        const { maCode, orderTotal } = req.body;
        if (!maCode) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá' });

        const promotionService = require('../../services/promotion.service');
        let khachHangId = null;
        if (req.session.user && req.session.user.role === 'CUSTOMER') {
            khachHangId = req.session.user.id;
        }
        const result = await promotionService.validateCode(maCode, orderTotal, khachHangId);
        
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.payment = async (req, res) => {
    const orderCode = req.params.orderCode;
    const [rows] = await db.pool.query('SELECT * FROM HoaDonBanHang WHERE MaHoaDon = ? AND TrangThai = ?', [orderCode, 'Pending']);
    
    if (rows.length === 0) {
        return res.redirect('/checkout/success?code=' + orderCode);
    }
    
    const order = rows[0];
    res.render('client/checkout/payment', {
        title: 'Thanh toán chuyển khoản',
        order: order,
        cartCount: req.session.cartCount || 0,
        user: req.session.user || null
    });
};

exports.processPayment = async (req, res) => {
    const { orderCode } = req.body;
    try {
        const [orders] = await db.pool.query('SELECT HoaDonId FROM HoaDonBanHang WHERE MaHoaDon = ?', [orderCode]);
        if (orders.length > 0) {
            const orderServiceLocal = require('../../services/order.service');
            await orderServiceLocal.updateStatus(orders[0].HoaDonId, 'Paid', 'Xác nhận thanh toán chuyển khoản thành công');
        } else {
            throw new Error('Không tìm thấy đơn hàng tương ứng');
        }
        return res.json({ success: true, message: 'Xác nhận thanh toán thành công!', redirectUrl: '/checkout/success?code=' + orderCode });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn hàng: ' + err.message });
    }
};

// Webhooks & Returns for VNPay and MoMo
const paymentService = require('../../services/payment.service');
const orderService = require('../../services/order.service');

async function getHoaDonIdByCode(orderCode) {
    const [rows] = await db.pool.query('SELECT HoaDonId FROM HoaDonBanHang WHERE MaHoaDon = ?', [orderCode]);
    return rows.length > 0 ? rows[0].HoaDonId : null;
}

exports.vnpayReturn = async (req, res) => {
    let vnp_Params = req.query;
    let { isValid, isSuccess } = paymentService.verifyVNPayReturn(vnp_Params);
    let orderCode = vnp_Params['vnp_TxnRef'];
    let hoaDonId = await getHoaDonIdByCode(orderCode);

    if (!hoaDonId) {
        return res.render('client/checkout/payment_result', { title: 'Lỗi', success: false, orderCode: orderCode, message: 'Không tìm thấy đơn hàng.' });
    }

    if (isValid && isSuccess) {
        await orderService.updateStatus(hoaDonId, 'Paid', 'Thanh toán VNPay thành công');
        res.render('client/checkout/payment_result', { title: 'Thanh toán thành công', success: true, orderCode: orderCode, message: 'Thanh toán VNPay thành công!' });
    } else if (isValid && !isSuccess) {
        await orderService.updateStatus(hoaDonId, 'Cancelled', 'Giao dịch VNPay bị hủy hoặc thất bại');
        res.render('client/checkout/payment_result', { title: 'Thanh toán thất bại', success: false, orderCode: orderCode, message: 'Giao dịch VNPay bị hủy hoặc thất bại.' });
    } else {
        res.render('client/checkout/payment_result', { title: 'Thanh toán thất bại', success: false, orderCode: orderCode, message: 'Chữ ký VNPay không hợp lệ.' });
    }
};

exports.momoReturn = async (req, res) => {
    let query = req.query;
    let { isValid, isSuccess } = paymentService.verifyMoMoReturn(query);
    let orderCode = query.extraData || query.orderId.split('_')[0]; 
    let hoaDonId = await getHoaDonIdByCode(orderCode);

    if (!hoaDonId) {
        return res.render('client/checkout/payment_result', { title: 'Lỗi', success: false, orderCode: orderCode, message: 'Không tìm thấy đơn hàng.' });
    }

    if (isValid && isSuccess) {
        await orderService.updateStatus(hoaDonId, 'Paid', 'Thanh toán MoMo thành công');
        res.render('client/checkout/payment_result', { title: 'Thanh toán thành công', success: true, orderCode: orderCode, message: 'Thanh toán MoMo thành công!' });
    } else if (isValid && !isSuccess) {
        await orderService.updateStatus(hoaDonId, 'Cancelled', 'Giao dịch MoMo bị hủy hoặc thất bại');
        res.render('client/checkout/payment_result', { title: 'Thanh toán thất bại', success: false, orderCode: orderCode, message: 'Giao dịch MoMo bị hủy hoặc thất bại.' });
    } else {
        res.render('client/checkout/payment_result', { title: 'Thanh toán thất bại', success: false, orderCode: orderCode, message: 'Chữ ký MoMo không hợp lệ.' });
    }
};

exports.vnpayIpn = async (req, res) => {
    let vnp_Params = req.query;
    let { isValid, isSuccess } = paymentService.verifyVNPayReturn(vnp_Params);
    let orderCode = vnp_Params['vnp_TxnRef'];
    let hoaDonId = await getHoaDonIdByCode(orderCode);

    if (!isValid) {
        return res.status(200).json({RspCode: '97', Message: 'Checksum failed'});
    }
    if (!hoaDonId) {
        return res.status(200).json({RspCode: '01', Message: 'Order not found'});
    }

    try {
        if (isSuccess) {
            await orderService.updateStatus(hoaDonId, 'Paid', 'IPN: Thanh toán VNPay thành công');
        } else {
            await orderService.updateStatus(hoaDonId, 'Cancelled', 'IPN: Giao dịch VNPay thất bại');
        }
        return res.status(200).json({RspCode: '00', Message: 'Confirm Success'});
    } catch (e) {
        // If order was already paid or cancelled, updateStatus throws an error.
        // VNPay expects 02 if order already confirmed
        return res.status(200).json({RspCode: '02', Message: 'Order already confirmed'});
    }
};

exports.momoIpn = async (req, res) => {
    let body = req.body;
    let { isValid, isSuccess } = paymentService.verifyMoMoReturn(body);
    let orderCode = body.extraData || body.orderId.split('_')[0];
    let hoaDonId = await getHoaDonIdByCode(orderCode);
    
    if (!isValid) return res.status(200).json({message: 'Signature failed'});
    if (!hoaDonId) return res.status(200).json({message: 'Order not found'});

    try {
        if (isSuccess) {
            await orderService.updateStatus(hoaDonId, 'Paid', 'IPN: Thanh toán MoMo thành công');
        } else {
            await orderService.updateStatus(hoaDonId, 'Cancelled', 'IPN: Giao dịch MoMo thất bại');
        }
        return res.status(200).json({message: 'Success'});
    } catch (e) {
        return res.status(200).json({message: 'Order already confirmed or error'});
    }
};

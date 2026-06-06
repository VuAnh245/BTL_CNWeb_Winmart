'use strict';
const productService = require('../../services/product.service');
const categoryService = require('../../services/category.service');

async function getPOS(req, res, next) {
  try {
    // Fetch active categories
    const categories = await categoryService.getAll({ is_active: 1 }, { limit: 100 });
    
    // Fetch initial products
    const productsResult = await productService.getAll({ is_active: 1 }, { page: 1, limit: 50, sortBy: 'TenSanPham', direction: 'ASC' });
    
    res.render('staff/pos/index', {
      title: 'Bán hàng tại quầy (POS)',
      currentRoute: '/staff/pos',
      user: req.session.user,
      categories: categories.items,
      products: productsResult.items
    });
  } catch (error) {
    next(error);
  }
}

async function searchProductsAPI(req, res) {
  try {
    const { keyword, categoryId } = req.query;
    const filters = { is_active: 1 };
    
    if (keyword) {
      // Basic check for barcode (only numbers) vs name
      if (/^\d{8,13}$/.test(keyword)) {
        filters.MaSanPham = keyword; // Hoặc Barcode nếu DB dùng field Barcode
      } else {
        filters.TenSanPham = { $like: `%${keyword}%` };
      }
    }
    
    if (categoryId) filters.DanhMucId = categoryId;
    
    const result = await productService.getAll(filters, { page: 1, limit: 50 });
    res.json({ success: true, products: result.items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

const checkoutService = require('../../services/checkout.service');

async function processCheckoutAPI(req, res) {
  try {
    const { cartItems, phuongThucTT, khachHangId, maGiamGia, diemSuDung } = req.body;
    
    // Validate
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng trống' });
    }

    const { pool } = require('../../config/db');
    const productIds = cartItems.map(item => item.id);
    const [products] = await pool.query('SELECT SanPhamId, ThueVAT FROM SanPham WHERE SanPhamId IN (?)', [productIds]);
    const vatMap = {};
    products.forEach(p => {
        vatMap[p.SanPhamId] = p.ThueVAT !== null ? p.ThueVAT : 10;
    });

    const checkoutParams = {
      khachHangId: khachHangId || null,
      cartItems: cartItems.map(item => ({
        sanPhamId: item.id,
        soLuong: item.qty,
        donGia: item.price,
        thueVAT: vatMap[item.id] !== undefined ? vatMap[item.id] : 10,
        phanTramGiam: 0
      })),
      phuongThucTT: phuongThucTT || 'TienMat',
      loaiGiao: 'TuLay', // POS is always Pick Up
      nhanVienId: req.session.user.id,
      maGiamGia: maGiamGia || null,
      diemSuDung: diemSuDung || 0
    };

    const result = await checkoutService.executeCheckout(checkoutParams);
    
    // Generate VNPay/MoMo URL if applicable
    if (phuongThucTT === 'VNPay' || phuongThucTT === 'MoMo') {
        const paymentService = require('../../services/payment.service');
        let payUrl = '';
        if (phuongThucTT === 'VNPay') {
            const returnUrl = req.protocol + '://' + req.get('host') + '/checkout/vnpay_return'; // Standard return
            payUrl = paymentService.createVNPayUrl(req, result.TongTien, result.MaHoaDon, returnUrl);
        } else if (phuongThucTT === 'MoMo') {
            const returnUrl = req.protocol + '://' + req.get('host') + '/checkout/momo_return';
            const ipnUrl = req.protocol + '://' + req.get('host') + '/checkout/momo_ipn';
            try {
                payUrl = await paymentService.createMoMoUrl(result.TongTien, result.MaHoaDon, returnUrl, ipnUrl);
            } catch (err) {
                console.error("POS MoMo Error", err);
            }
        }
        return res.json({ success: true, order: result, redirectUrl: payUrl });
    }

    res.json({ success: true, order: result });
  } catch (error) {
    console.error('[POS Checkout Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi thanh toán' });
  }
}

const customerService = require('../../services/customer.service');

async function searchCustomerAPI(req, res) {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại' });
    
    const customer = await customerService.getByPhone(phone);
    if (customer) {
      res.json({ success: true, customer });
    } else {
      res.json({ success: false, message: 'Không tìm thấy khách hàng' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function registerCustomerAPI(req, res) {
  try {
    const { HoTen, SoDienThoai } = req.body;
    if (!HoTen || !SoDienThoai) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    
    const result = await customerService.create({ HoTen, SoDienThoai }, req.session.user.id);
    
    // Fetch back the new customer to get all fields like points, tier
    const customer = await customerService.getById(result.khachHangId);
    
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function validatePromoAPI(req, res) {
    try {
        const { maCode, orderTotal, khachHangId } = req.body;
        if (!maCode) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá' });

        const promotionService = require('../../services/promotion.service');
        const result = await promotionService.validateCode(maCode, orderTotal, khachHangId);
        
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function checkPaymentAPI(req, res) {
    try {
        const { orderCode } = req.params;
        const { pool } = require('../../config/db');
        const [rows] = await pool.query('SELECT TrangThai FROM HoaDonBanHang WHERE MaHoaDon = ?', [orderCode]);
        if (rows.length > 0 && rows[0].TrangThai === 'Paid') {
            return res.json({ success: true, isPaid: true });
        }
        res.json({ success: true, isPaid: false });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
  getPOS,
  searchProductsAPI,
  processCheckoutAPI,
  searchCustomerAPI,
  registerCustomerAPI,
  validatePromoAPI,
  checkPaymentAPI
};

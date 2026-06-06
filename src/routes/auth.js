const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { redirectIfAuthenticated } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const authValidation = require('../validations/auth.validation');
const passport = require('passport');

// =============================================
// GET: Form login
// =============================================
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('client/auth/login', { 
    title: 'Đăng nhập - WinMart',
    layout: false,
    old: req.session.old || {},
    error: req.flash('error')[0] || null
  });
  req.session.old = {};
});

// =============================================
// ✅ POST: Xử lý login (HỖ TRỢ CẢ NhanVien + KhachHang)
// =============================================
router.post('/login', validate(authValidation.login), async (req, res) => {
  try {
    // Nhận cả 2 tên field: 'identifier' (mỚi) hoặc 'TenDangNhap' (trang cũ)
    const identifier = req.body.identifier || req.body.TenDangNhap;
    const password   = req.body.password   || req.body.MatKhau;
    const rememberMe = req.body.rememberMe;

    console.log('🔐 [LOGIN] Attempt:', { identifier, hasPassword: !!password });

    let user = null;
    let source = null; // 'staff' | 'customer'

    // 🔍 Bước 1: Tìm trong bảng NhanVien trước (Staff/Admin)
    const [staffRows] = await db.pool.query(
      `SELECT 
         NhanVienId, MaNhanVien, HoTen, SoDienThoai, Email, 
         MatKhauHash, VaiTro, TrangThai, NgayVaoLam
       FROM NhanVien 
       WHERE (TenDangNhap = ? OR Email = ? OR SoDienThoai = ?) 
       AND TrangThai = 'DangLam'
       LIMIT 1`,
      [identifier, identifier, identifier]
    );

    if (staffRows.length > 0) {
      user = staffRows[0];
      source = 'staff';
      console.log('👤 [LOGIN] Found in NhanVien table');
    } else {
      // 🔍 Bước 2: Tìm trong bảng KhachHang (Customer)
      const [customerRows] = await db.pool.query(
        `SELECT 
           KhachHangId, MaKhachHang, HoTen, SoDienThoai, Email, 
           MatKhauHash, CapDoVIP, TongDiemTichLuy, TongChiTieu
         FROM KhachHang 
         WHERE (Email = ? OR SoDienThoai = ?) 
         AND is_active = 1
         LIMIT 1`,
        [identifier, identifier]
      );

      if (customerRows.length > 0) {
        // Kiểm tra xem hệ thống có đang bảo trì không
        const [sysRows] = await db.pool.query('SELECT BaoTriHeThong FROM cuahang LIMIT 1');
        if (sysRows.length > 0 && sysRows[0].BaoTriHeThong === 1) {
            if (req.body.isAjax) {
                return res.json({ success: false, message: 'Hệ thống mua sắm đang bảo trì, bạn không thể đăng nhập lúc này.' });
            }
            req.flash('error', 'Hệ thống mua sắm đang bảo trì, bạn không thể đăng nhập lúc này.');
            req.session.old = { identifier };
            const backUrl = req.get('Referrer') || '/auth/login';
            return res.redirect(req.body.isModal ? backUrl + (backUrl.includes('?') ? '&' : '?') + 'openModal=login' : backUrl);
        }

        user = customerRows[0];
        source = 'customer';
        console.log('👤 [LOGIN] Found in KhachHang table');
      }
    }

    // ❌ Không tìm thấy user
    if (!user) {
      if (req.body.isAjax) {
        return res.json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
      }
      req.flash('error', 'Tài khoản không tồn tại hoặc đã bị khóa');
      req.session.old = { identifier };
      const backUrl = req.get('Referrer') || '/auth/login';
      return res.redirect(req.body.isModal ? backUrl + (backUrl.includes('?') ? '&' : '?') + 'openModal=login' : backUrl);
    }

    // 🔐 Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.MatKhauHash);
    if (!isMatch) {
      if (req.body.isAjax) {
        return res.json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
      }
      req.flash('error', 'Tài khoản hoặc mật khẩu không chính xác');
      req.session.old = { identifier };
      const backUrl = req.get('Referrer') || '/auth/login';
      return res.redirect(req.body.isModal ? backUrl + (backUrl.includes('?') ? '&' : '?') + 'openModal=login' : backUrl);
    }

    // ✅ Đăng nhập thành công - Build session user
    if (source === 'staff') {
      // Staff/Admin từ bảng NhanVien
      const role = (user.VaiTro || 'STAFF').toUpperCase();
      
      req.session.user = {
        id: user.NhanVienId,
        code: user.MaNhanVien,
        name: user.HoTen,
        email: user.Email,
        phone: user.SoDienThoai,
        role: role, // 'ADMIN' | 'STAFF' | 'CUSTOMER'
        status: user.TrangThai,
        joinedAt: user.NgayVaoLam
      };

      console.log(`✅ [LOGIN] Staff success: ${user.HoTen} | Role: ${role}`);

      // Ghi nhớ đăng nhập
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        req.session.cookie.expires = false; // Session cookie
      }

      await new Promise(resolve => req.session.save(resolve));

      // Redirect dựa vào vai trò
      let targetUrl = '/';
      switch (role) {
        case 'ADMIN':
        case 'QUANLY':
          targetUrl = '/admin';
          req.flash('success', `Chào mừng Quản lý ${user.HoTen}`);
          break;
        case 'STAFF':
        case 'NHANVIENPOS':
          targetUrl = '/staff/pos';
          break;
        default:
          req.flash('success', `Chào mừng bạn, ${user.HoTen}!`);
          break;
      }
      
      if (req.body.isAjax) {
        return res.json({ success: true, redirectUrl: targetUrl });
      }
      return res.redirect(targetUrl);

    } else {
      // Customer từ bảng KhachHang
      req.session.user = {
        id: user.KhachHangId,
        code: user.MaKhachHang,
        name: user.HoTen,
        email: user.Email,
        phone: user.SoDienThoai,
        role: 'CUSTOMER',
        loyaltyTier: user.CapDoVIP,
        loyaltyPoints: user.TongDiemTichLuy,
        totalSpent: user.TongChiTieu
      };

      console.log(`✅ [LOGIN] Customer success: ${user.HoTen}`);

      req.flash('success', `Chào mừng bạn quay trở lại, ${user.HoTen}!`);
      
      // Ghi nhớ đăng nhập
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        req.session.cookie.expires = false; // Session cookie
      }
      
      // Redirect về trang chủ hoặc trang đã lưu trước đó
      const redirectUrl = req.session.redirectTo || '/';
      delete req.session.redirectTo;
      await new Promise(resolve => req.session.save(resolve));
      
      if (req.body.isAjax) {
        return res.json({ success: true, redirectUrl });
      }
      return res.redirect(redirectUrl);
    }

  } catch (err) {
    console.error('❌ [LOGIN ERROR]:', err.message);
    console.error(err.stack);
    
    if (req.body.isAjax) {
      return res.json({ success: false, message: 'Đăng nhập thất bại: ' + err.message });
    }
    
    req.flash('error', 'Đăng nhập thất bại: ' + err.message);
    req.session.old = { identifier: req.body?.identifier };
    const backUrl = req.get('Referrer') || '/auth/login';
    return res.redirect(req.body?.isModal ? backUrl + (backUrl.includes('?') ? '&' : '?') + 'openModal=login' : backUrl);
  }
});

// =============================================
// GET: Form register
// =============================================
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('client/auth/register', { 
    title: 'Đăng ký - WinMart',
    layout: false,
    old: {},
    errors: {}
  });
});

// =============================================
// POST: Xử lý đăng ký (vào bảng KhachHang)
// =============================================
router.post('/register', validate(authValidation.register), async (req, res) => {
  try {
    const { fullName, phone, email, password, confirmPassword } = req.body;

    console.log("📥 [REGISTER] Nhận dữ liệu:", { fullName, phone, email });

    // Kiểm tra trùng
    const [existing] = await db.pool.query(
      `SELECT KhachHangId FROM KhachHang WHERE SoDienThoai = ? OR Email = ? LIMIT 1`,
      [phone, email || null]
    );

    if (existing.length > 0) {
      const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (isAjax) {
        return res.json({ success: false, message: 'Số điện thoại hoặc email đã được sử dụng' });
      }
      req.flash('error', 'Số điện thoại hoặc email đã được sử dụng');
      return res.redirect('/auth/register');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const maKhachHang = `KH${Date.now()}`;

    console.log(`🔄 [REGISTER] Đang insert: ${maKhachHang}`);

    const [result] = await db.pool.query(
      `INSERT INTO KhachHang (MaKhachHang, HoTen, SoDienThoai, Email, MatKhauHash, CapDoVIP, is_active)
       VALUES (?, ?, ?, ?, ?, 'Thuong', 1)`,
      [maKhachHang, fullName.trim(), phone, email || null, passwordHash]
    );

    console.log(`✅ [REGISTER] THÀNH CÔNG! ID = ${result.insertId}`);

    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.json({ success: true, message: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.' });
    }

    req.flash('success', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
    await new Promise(resolve => req.session.save(resolve));
    res.redirect('/auth/login');

  } catch (err) {
    console.error("❌ [REGISTER ERROR]:", err.sqlMessage || err.message);
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.json({ success: false, message: 'Đăng ký thất bại: ' + (err.sqlMessage || err.message) });
    }
    req.flash('error', 'Đăng ký thất bại: ' + (err.sqlMessage || err.message));
    res.redirect('/auth/register');
  }
});

// =============================================
// GET: Logout
// =============================================
router.get('/logout', (req, res) => {
  const userName = req.session.user?.name;
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    console.log(`👋 [LOGOUT] ${userName}`);
    res.redirect('/');
  });
});

// =============================================
// POST: Quên mật khẩu
// =============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email hoặc số điện thoại' });
    }

    const [customerRows] = await db.pool.query(
      `SELECT KhachHangId, HoTen, Email, SoDienThoai FROM KhachHang 
       WHERE (Email = ? OR SoDienThoai = ?) AND is_active = 1 LIMIT 1`,
      [identifier, identifier]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    const customer = customerRows[0];
    if (!customer.Email) {
      return res.status(400).json({ success: false, message: 'Tài khoản này chưa cập nhật email. Vui lòng liên hệ tổng đài.' });
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newPassword = '';
    for (let i = 0; i < 6; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.pool.query('UPDATE KhachHang SET MatKhauHash = ? WHERE KhachHangId = ?', [hashed, customer.KhachHangId]);

    const emailService = require('../services/email.service');
    await emailService.sendForgotPasswordEmail(customer.Email, customer, newPassword);

    res.json({ success: true, message: 'Mật khẩu mới đã được gửi vào email của bạn' });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
});

// =============================================
// GOOGLE OAUTH 2.0
// =============================================

// GET: Chuyển hướng sang trang đăng nhập Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// GET: Google callback - xử lý kết quả trả về
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login',
    failureFlash: 'Đăng nhập Google thất bại'
  }),
  async (req, res) => {
    try {
      // Build session user giống hệt luồng đăng nhập thủ công
      const user = req.user;
      req.session.user = {
        id: user.KhachHangId,
        code: user.MaKhachHang,
        name: user.HoTen,
        email: user.Email,
        phone: user.SoDienThoai,
        role: 'CUSTOMER',
        loyaltyTier: user.CapDoVIP,
        loyaltyPoints: user.TongDiemTichLuy,
        totalSpent: user.TongChiTieu
      };

      console.log(`✅ [GOOGLE LOGIN] Thành công: ${user.HoTen} (${user.Email})`);

      // Check if phone number is missing
      if (!user.SoDienThoai) {
        req.session.requiresPhone = true;
        return res.redirect('/auth/complete-profile');
      }

      req.flash('success', `Chào mừng bạn, ${user.HoTen}!`);

      const redirectUrl = req.session.redirectTo || '/';
      delete req.session.redirectTo;
      await new Promise(resolve => req.session.save(resolve));

      res.redirect(redirectUrl);
    } catch (err) {
      console.error('❌ [GOOGLE CALLBACK ERROR]:', err.message);
      req.flash('error', 'Có lỗi xảy ra khi đăng nhập bằng Google');
      res.redirect('/auth/login');
    }
  }
);

// =============================================
// HOÀN THIỆN HỒ SƠ (BỔ SUNG SĐT)
// =============================================

// GET: Hiển thị form bổ sung SĐT
router.get('/complete-profile', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  if (!req.session.requiresPhone) return res.redirect('/');
  
  res.render('client/auth/complete-profile', { 
    title: 'Bổ sung thông tin',
    user: req.session.user
  });
});

// POST: Xử lý bổ sung SĐT
router.post('/complete-profile', async (req, res) => {
  try {
    if (!req.session.user || !req.session.requiresPhone) {
      return res.status(403).json({ success: false, message: 'Yêu cầu không hợp lệ' });
    }

    const { phone } = req.body;
    const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
    
    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ' });
    }

    // Kiểm tra trùng SĐT
    const [existing] = await db.pool.query(
      'SELECT KhachHangId FROM KhachHang WHERE SoDienThoai = ? AND is_active = 1',
      [phone]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác' 
      });
    }

    // Cập nhật SĐT vào database
    await db.pool.query(
      'UPDATE KhachHang SET SoDienThoai = ? WHERE KhachHangId = ?',
      [phone, req.session.user.id]
    );

    // Cập nhật session
    req.session.user.phone = phone;
    delete req.session.requiresPhone;
    await new Promise(resolve => req.session.save(resolve));

    req.flash('success', 'Tuyệt vời! Bạn đã cập nhật số điện thoại thành công.');

    const redirectUrl = req.session.redirectTo || '/';
    delete req.session.redirectTo;

    res.json({ success: true, redirectUrl });

  } catch (err) {
    console.error('❌ [COMPLETE PROFILE ERROR]:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ, vui lòng thử lại sau' });
  }
});

module.exports = router;
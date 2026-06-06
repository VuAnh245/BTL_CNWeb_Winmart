// src/controllers/client/auth.controller.js
const bcrypt = require('bcryptjs');
const db = require('../../config/db');

// =============================================
// GET: Hiển thị form login
// =============================================
exports.getLogin = (req, res) => {
  res.render('client/auth/login', { 
    title: 'Đăng nhập - WinMart',
    old: req.session.old || {},
    error: req.flash('error')[0] || null
  });
  req.session.old = {};
};

// =============================================
// POST: Xử lý đăng nhập
// =============================================
exports.postLogin = async (req, res) => {
  try {
    // Nhận cả 2 tên field: 'identifier' (modal) hoặc 'TenDangNhap' (trang riêng)
    const identifier = req.body.identifier || req.body.TenDangNhap;
    const password   = req.body.password   || req.body.MatKhau;
    const rememberMe = req.body.rememberMe;

    console.log('🔐 [LOGIN] Attempt:', { 
      identifier, 
      hasPassword: !!password,
      rememberMe: !!rememberMe 
    });

    // ✅ Validate input cơ bản
    if (!identifier || !password) {
      req.flash('error', 'Vui lòng nhập đầy đủ email/số điện thoại và mật khẩu');
      req.session.old = { identifier };
      // ✅ FIX: Đợi session lưu xong mới redirect
      await new Promise(resolve => req.session.save(resolve));
      return res.redirect('/auth/login');
    }

    // =============================================
    // 🔍 Tìm user trong bảng KhachHang (CUSTOMER)
    // =============================================
    let [rows] = await db.pool.query(
      `SELECT 
         KhachHangId, MaKhachHang, HoTen, SoDienThoai, Email, 
         MatKhauHash, VaiTro, CapDoVIP,
         TongDiemTichLuy, TongChiTieu
       FROM KhachHang 
       WHERE (Email = ? OR SoDienThoai = ?) 
       AND is_active = 1
       LIMIT 1`,
      [identifier, identifier]
    );

    let user = rows[0];
    let source = 'customer';

    // =============================================
    // 🔍 Nếu không tìm thấy, thử tìm trong NhanVien (STAFF/ADMIN)
    // =============================================
    if (!user) {
      [rows] = await db.pool.query(
        `SELECT 
           NhanVienId, MaNhanVien, HoTen, SoDienThoai, Email, 
           MatKhauHash, VaiTro, TrangThai, NgayVaoLam
         FROM NhanVien 
         WHERE (TenDangNhap = ? OR Email = ? OR SoDienThoai = ?) 
         AND TrangThai = 'DangLam'
         LIMIT 1`,
        [identifier, identifier, identifier]
      );
      user = rows[0];
      source = 'staff';
    }

    // ❌ Không tìm thấy user nào
    if (!user) {
      req.flash('error', 'Tài khoản không tồn tại hoặc đã bị khóa');
      req.session.old = { identifier };
      // ✅ FIX: Đợi session lưu xong mới redirect
      await new Promise(resolve => req.session.save(resolve));
      return res.redirect('/auth/login');
    }

    // 🔐 Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.MatKhauHash);
    if (!isMatch) {
      req.flash('error', 'Mật khẩu không chính xác');
      req.session.old = { identifier };
      // ✅ FIX: Đợi session lưu xong mới redirect
      await new Promise(resolve => req.session.save(resolve));
      return res.redirect('/auth/login');
    }

    // =============================================
    // ✅ Đăng nhập thành công - Build session user
    // =============================================
    
    const rawRole = user.VaiTro || (source === 'customer' ? 'CUSTOMER' : 'STAFF');
    const role = rawRole.toUpperCase();

    req.session.user = source === 'customer' 
      ? {
          id: user.KhachHangId,
          code: user.MaKhachHang,
          name: user.HoTen,
          email: user.Email,
          phone: user.SoDienThoai,
          role: role,
          loyaltyTier: user.CapDoVIP,
          loyaltyPoints: user.TongDiemTichLuy,
          totalSpent: user.TongChiTieu
        }
      : {
          id: user.NhanVienId,
          code: user.MaNhanVien,
          name: user.HoTen,
          email: user.Email,
          phone: user.SoDienThoai,
          role: role,
          status: user.TrangThai,
          joinedAt: user.NgayVaoLam
        };

    // ⏰ Remember me
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    console.log(`✅ [LOGIN] Thành công: ${req.session.user.name} | Role: ${role}`);

    // 🎯 Redirect theo role
    await new Promise(resolve => req.session.save(resolve));
    switch (role) {
      case 'ADMIN':
        req.flash('success', `Chào mừng Admin ${user.HoTen}!`);
        return res.redirect('/admin');
        
      case 'STAFF':
        req.flash('success', `Chào mừng ${user.HoTen}!`);
        return res.redirect('/staff/pos');
        
      case 'CUSTOMER':
      default:
        req.flash('success', `Chào mừng bạn quay trở lại, ${user.HoTen}!`);
        const redirectUrl = req.session.redirectTo || '/';
        delete req.session.redirectTo;
        return res.redirect(redirectUrl);
    }

  } catch (err) {
    console.error('❌ [LOGIN ERROR]:', err.message);
    req.flash('error', 'Đăng nhập thất bại: ' + err.message);
    req.session.old = { identifier: req.body?.identifier };
    await new Promise(resolve => req.session.save(resolve));
    return res.redirect('/auth/login');
  }
};

// =============================================
// GET: Đăng xuất
// =============================================
exports.getLogout = (req, res) => {
  const userName = req.session.user?.name;
  const userRole = req.session.user?.role;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ [LOGOUT ERROR]:', err.message);
    } else {
      console.log(`👋 [LOGOUT] ${userName} (${userRole})`);
      req.flash('success', 'Bạn đã đăng xuất thành công');
    }
    res.redirect('/');
  });
};  
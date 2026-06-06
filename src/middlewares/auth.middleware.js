/**
 * Auth Middleware - Kiểm tra session & phân quyền
 * Tương thích với bảng: NhanVien (VaiTro ENUM), KhachHang
 * 
 * ✅ ĐÃ FIX: 
 * - Dùng connect-flash thay vì custom session.flashMessages
 * - Chuẩn hóa role về UPPERCASE để đồng bộ so sánh
 */

/**
 * Check user đã đăng nhập chưa
 * Nếu chưa: lưu redirect URL và chuyển đến login
 */
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) {
    // Lưu URL hiện tại để redirect sau khi login
    req.session.redirectTo = req.originalUrl;
    
    // ✅ FIX: Dùng connect-flash thay vì custom session
    req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
    
    return res.redirect('/auth/login');
  }
  next();
};

/**
 * Check role - Chỉ cho phép role cụ thể truy cập
 * @param {string[]} allowedRoles - Mảng role được phép: ['ADMIN'], ['STAFF', 'ADMIN'], ['CUSTOMER']
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // ✅ Chuẩn hóa role về UPPERCASE để so sánh chính xác
    const userRole = req.session?.user?.role?.toUpperCase();
    
    if (!userRole) {
      return res.redirect('/auth/login');
    }
    
    if (!allowedRoles.map(r => r.toUpperCase()).includes(userRole)) {
      // ✅ FIX: Dùng connect-flash
      req.flash('error', 'Bạn không có quyền truy cập tính năng này');
      
      // Redirect về trang phù hợp theo role
      const redirectMap = {
        'ADMIN': '/admin',
        'STAFF': '/staff', 
        'CUSTOMER': '/'
      };
      return res.redirect(redirectMap[userRole] || '/');
    }
    next();
  };
};

/**
 * Check nếu đã login thì không cho vào trang auth (login/register)
 * Dùng để redirect user đã login về trang chủ/dashboard
 */
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session?.user?.id) {
    // ✅ Chuẩn hóa role về UPPERCASE
    const userRole = req.session.user.role?.toUpperCase();
    
    const redirectMap = {
      'ADMIN': '/admin',
      'STAFF': '/staff',
      'CUSTOMER': '/'
    };
    return res.redirect(redirectMap[userRole] || '/');
  }
  next();
};

/**
 * Helper: Lấy thông tin user từ DB và gắn vào session
 * (Dùng trong Auth Controller sau khi verify password)
 * 
 * @param {Object} userRow - Kết quả query từ bảng NhanVien hoặc KhachHang
 * @param {string} source - 'staff' | 'customer'
 */
const buildSessionUser = (userRow, source) => {
  if (source === 'staff') {
    // Từ bảng NhanVien
    return {
      id: userRow.NhanVienId,
      code: userRow.MaNhanVien,
      fullName: userRow.HoTen,
      email: userRow.Email,
      phone: userRow.SoDienThoai,
      // ✅ FIX: Chuẩn hóa role về UPPERCASE
      role: (userRow.VaiTro || 'STAFF').toUpperCase(),
      status: userRow.TrangThai,
      joinedAt: userRow.NgayVaoLam
    };
  } else {
    // Từ bảng KhachHang
    return {
      id: userRow.KhachHangId,
      code: userRow.MaKhachHang,
      fullName: userRow.HoTen,
      email: userRow.Email,
      phone: userRow.SoDienThoai,
      // ✅ FIX: Đảm bảo role là UPPERCASE
      role: 'CUSTOMER',
      vipTier: userRow.CapDoVIP, // 'Thuong' | 'VIP1' | 'VIP2' | 'VIP3'
      loyaltyPoints: userRow.TongDiemTichLuy,
      totalSpent: userRow.TongChiTieu
    };
  }
};

module.exports = {
  requireAuth,
  requireRole,
  redirectIfAuthenticated,
  buildSessionUser
};
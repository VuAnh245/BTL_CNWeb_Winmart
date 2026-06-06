'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode } = require('../utils/generateCode');
const { hashPassword, comparePassword } = require('../utils/hash');
const { ROLES } = require('../constants/roles');
const { MSG } = require('../constants/messages');

/**
 * Lấy danh sách nhân viên với filter, phân quyền
 * @param {Object} filters - { VaiTro, TrangThai, is_active, TenDangNhap }
 * @param {Object} pagination - { page, limit, sortBy }
 * @param {string} requesterRole - Role người request (để filter data)
 * @returns {Promise<{ items: Array, meta: Object }>}
 */
async function getAll(filters = {}, pagination = {}, requesterRole = ROLES.ADMIN) {
  // Admin xem tất cả, Staff chỉ xem store của mình (future multi-store)
  const roleFilter = requesterRole === ROLES.ADMIN ? {} : { storeId: filters.storeId };
  const mergedFilters = { ...filters, ...roleFilter };
  
  const { where, params } = buildWhere(mergedFilters, { tableAlias: 'nv' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['HoTen', 'NgayVaoLam', 'NgayTao']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM NhanVien nv ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT nv.NhanVienId, nv.MaNhanVien, nv.HoTen, nv.TenDangNhap, 
            nv.VaiTro, nv.SoDienThoai, nv.Email, nv.NgayVaoLam, 
            nv.TrangThai, nv.is_active, nv.NgayTao, nv.NgayCapNhat
     FROM NhanVien nv ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  // Mask sensitive data
  const items = rows.map(r => ({
    ...r,
    MatKhauHash: undefined, // Never expose hash
  }));
  
  return { items, meta: meta(total) };
}

/**
 * Lấy chi tiết nhân viên theo ID
 */
async function getById(nhanVienId, requesterId, requesterRole) {
  // Check permission: Admin xem được tất cả, Staff chỉ xem bản thân
  let permissionCondition = '';
  if (requesterRole === ROLES.STAFF) {
    if (requesterId !== parseInt(nhanVienId)) {
      throw new Error(MSG.AUTH.FORBIDDEN);
    }
  }
  
  const [rows] = await pool.query(
    `SELECT nv.*, 
       (SELECT COUNT(*) FROM HoaDonBanHang hd WHERE hd.NhanVienId = nv.NhanVienId) as soDonDaBan
     FROM NhanVien nv 
     WHERE nv.NhanVienId = ? ${permissionCondition}`,
    [nhanVienId]
  );
  
  const user = rows[0];
  if (!user) return null;
  
  delete user.MatKhauHash;
  return user;
}

/**
 * Tạo nhân viên mới (chỉ Admin)
 */
async function create(data, adminId) {
  const {
    HoTen, TenDangNhap, MatKhau, VaiTro, SoDienThoai, Email, NgayVaoLam
  } = data;
  
  if (!VaiTro || !Object.values(ROLES).includes(VaiTro)) {
    throw new Error('Vai trò không hợp lệ');
  }
  
  if (VaiTro === ROLES.ADMIN) {
    throw new Error('Hệ thống chỉ cho phép 1 Quản trị viên duy nhất.');
  }
  
  return withTransaction(async (conn) => {
    // Validate unique
    const [exists] = await conn.query(
      'SELECT 1 FROM NhanVien WHERE (TenDangNhap = ? OR SoDienThoai = ? OR Email = ?) AND is_active = 1',
      [TenDangNhap, SoDienThoai, Email]
    );
    if (exists.length > 0) {
      throw new Error('Tên đăng nhập, SĐT hoặc Email đã tồn tại');
    }
    
    const MaNhanVien = generateCode('NV', 4);
    const matKhauHash = await hashPassword(MatKhau);
    
    const [result] = await conn.query(
      `INSERT INTO NhanVien 
       (MaNhanVien, HoTen, TenDangNhap, MatKhauHash, VaiTro, 
        SoDienThoai, Email, NgayVaoLam, TrangThai, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DangLam', 1)`,
      [MaNhanVien, HoTen, TenDangNhap, matKhauHash, VaiTro, SoDienThoai, Email, NgayVaoLam]
    );
    
    return { nhanVienId: result.insertId, maNhanVien: MaNhanVien };
  });
}

/**
 * Cập nhật thông tin nhân viên
 */
async function update(nhanVienId, updates, requesterId, requesterRole) {
  let { HoTen, SoDienThoai, Email, VaiTro, TrangThai, MatKhauMoi } = updates;
  
  return withTransaction(async (conn) => {
    // Staff chỉ được update bản thân
    if (requesterRole === ROLES.STAFF && requesterId !== parseInt(nhanVienId)) {
      throw new Error(MSG.AUTH.FORBIDDEN);
    }
    
    const [current] = await conn.query(
      'SELECT VaiTro FROM NhanVien WHERE NhanVienId = ? AND is_active = 1',
      [nhanVienId]
    );
    
    if (current.length === 0) throw new Error('Nhân viên không tồn tại');
    
    // Staff không được tự đổi role hoặc trạng thái
    if (requesterRole === ROLES.STAFF && (VaiTro || TrangThai)) {
       throw new Error(MSG.AUTH.FORBIDDEN);
    }

    // Quản trị viên không được hạ quyền Quản trị viên khác
    if (requesterRole === ROLES.ADMIN && current[0].VaiTro === ROLES.ADMIN && requesterId !== parseInt(nhanVienId)) {
        if (VaiTro && VaiTro !== ROLES.ADMIN) {
            throw new Error('Không thể hạ quyền của một Quản trị viên khác');
        }
    }

    // Không được phép nâng quyền ai đó thành Quản trị viên
    if (VaiTro === ROLES.ADMIN && current[0].VaiTro !== ROLES.ADMIN) {
        throw new Error('Hệ thống chỉ cho phép 1 Quản trị viên duy nhất.');
    }

    // Quản trị viên không được tự đổi quyền hoặc trạng thái của chính mình
    if (requesterRole === ROLES.ADMIN && requesterId === parseInt(nhanVienId)) {
        // Nếu có truyền lên thì ép về undefined để không update
        VaiTro = undefined;
        TrangThai = undefined;
    }
    
    // Validate unique nếu đổi SĐT/Email
    if (SoDienThoai || Email) {
      const [exists] = await conn.query(
        'SELECT 1 FROM NhanVien WHERE (SoDienThoai = ? OR Email = ?) AND NhanVienId != ? AND is_active = 1',
        [SoDienThoai || '', Email || '', nhanVienId]
      );
      if (exists.length > 0) {
        throw new Error('SĐT hoặc Email đã được sử dụng');
      }
    }
    
    const fields = [];
    const params = [];
    
    if (HoTen) { fields.push('HoTen = ?'); params.push(HoTen); }
    if (SoDienThoai !== undefined) { fields.push('SoDienThoai = ?'); params.push(SoDienThoai); }
    if (Email !== undefined) { fields.push('Email = ?'); params.push(Email); }
    if (VaiTro && requesterId !== nhanVienId) { fields.push('VaiTro = ?'); params.push(VaiTro); }
    if (TrangThai && requesterId !== nhanVienId) { fields.push('TrangThai = ?'); params.push(TrangThai); }
    
    // Đổi mật khẩu
    if (MatKhauMoi) {
      fields.push('MatKhauHash = ?');
      params.push(await hashPassword(MatKhauMoi));
    }
    
    if (fields.length === 0) return true;
    
    params.push(nhanVienId);
    
    const [result] = await conn.query(
      `UPDATE NhanVien SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
       WHERE NhanVienId = ? AND is_active = 1`,
      params
    );
    
    return result.affectedRows > 0;
  });
}

/**
 * Soft delete nhân viên (Admin only)
 */
async function softDelete(nhanVienId, adminId, requesterRole) {
  if (requesterRole === ROLES.STAFF) {
    throw new Error(MSG.AUTH.FORBIDDEN);
  }
  
  if (parseInt(nhanVienId) === adminId) {
    throw new Error('Bạn không thể tự cho mình nghỉ việc');
  }

  const [target] = await pool.query('SELECT VaiTro FROM NhanVien WHERE NhanVienId = ?', [nhanVienId]);
  if (target.length > 0 && target[0].VaiTro === ROLES.ADMIN) {
    throw new Error('Không thể xóa/cho nghỉ việc một Quản trị viên khác');
  }

  // Luôn thực hiện Soft Delete (Khóa tài khoản, giữ lại lịch sử) thay vì xóa cứng
  const [result] = await pool.query(
    'UPDATE NhanVien SET TrangThai = "NghiViec", NgayCapNhat = CURRENT_TIMESTAMP WHERE NhanVienId = ?',
    [nhanVienId]
  );
  
  return { success: result.affectedRows > 0, hardDeleted: false };
}

/**
 * Đổi mật khẩu (cho chính user hoặc admin reset)
 */
async function changePassword(userId, oldPassword, newPassword, isSelf = true) {
  if (!isSelf) {
    // Admin reset: không cần old password
    const hash = await hashPassword(newPassword);
    const [result] = await pool.query(
      'UPDATE NhanVien SET MatKhauHash = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE NhanVienId = ?',
      [hash, userId]
    );
    return result.affectedRows > 0;
  }
  
  // Self change: verify old password
  const [user] = await pool.query(
    'SELECT MatKhauHash FROM NhanVien WHERE NhanVienId = ? AND is_active = 1',
    [userId]
  );
  
  if (!user.length) throw new Error('Người dùng không tồn tại');
  
  const valid = await comparePassword(oldPassword, user[0].MatKhauHash);
  if (!valid) throw new Error('Mật khẩu cũ không đúng');
  
  const hash = await hashPassword(newPassword);
  const [result] = await pool.query(
    'UPDATE NhanVien SET MatKhauHash = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE NhanVienId = ?',
    [hash, userId]
  );
  
  return result.affectedRows > 0;
}

/**
 * Kiểm tra đăng nhập cho nhân viên
 */
async function authenticate(tenDangNhap, matKhau) {
  const [rows] = await pool.query(
    `SELECT NhanVienId, MaNhanVien, HoTen, TenDangNhap, VaiTro, 
            MatKhauHash, TrangThai, is_active, SoDienThoai, Email
     FROM NhanVien 
     WHERE TenDangNhap = ? AND is_active = 1
     LIMIT 1`,
    [tenDangNhap]
  );
  
  if (rows.length === 0) {
    throw new Error(MSG.AUTH.LOGIN_FAIL);
  }
  
  const user = rows[0];
  
  const valid = await comparePassword(matKhau, user.MatKhauHash);
  if (!valid) {
    throw new Error(MSG.AUTH.LOGIN_FAIL);
  }
  
  if (user.TrangThai !== 'DangLam') {
    throw new Error(MSG.AUTH.ACCOUNT_LOCKED);
  }
  
  delete user.MatKhauHash;
  
  return {
    user,
    sessionData: {
      userId: user.NhanVienId,
      userCode: user.MaNhanVien,
      userName: user.HoTen,
      userRole: user.VaiTro,
      userEmail: user.Email,
    }
  };
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete,
  changePassword,
  authenticate,
};
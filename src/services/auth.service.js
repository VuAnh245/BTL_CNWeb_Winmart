'use strict';

const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateCode } = require('../utils/generateCode');
const { ROLES } = require('../constants/roles');
const { MSG } = require('../constants/messages');

/**
 * Đăng ký tài khoản mới
 * @param {Object} data - { hoTen, email, sdt, matKhau, vaiTro? }
 * @returns {Promise<{ userId, maUser }>}
 */
async function register(data) {
  const { hoTen, email, sdt, matKhau, vaiTro = ROLES.CUSTOMER } = data;
  
  // Validate unique (dùng transaction để tránh race condition)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Check unique email/sdt
    const [exists] = await conn.query(
      'SELECT 1 FROM KhachHang WHERE (Email = ? OR SoDienThoai = ?) AND is_active = 1',
      [email, sdt]
    );
    if (exists.length > 0) {
      throw new Error(MSG.AUTH.EMAIL_EXISTED);
    }
    
    // Hash password
    const matKhauHash = await hashPassword(matKhau);
    const maKhachHang = generateCode('KH', 6);
    
    // Insert
    const [result] = await conn.query(
      `INSERT INTO KhachHang 
       (MaKhachHang, HoTen, Email, SoDienThoai, CapDoVIP, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [maKhachHang, hoTen, email, sdt, 'Thuong']
    );
    
    await conn.commit();
    return { userId: result.insertId, maUser: maKhachHang };
    
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Đăng nhập với bcrypt verification
 * @param {string} identifier - Email hoặc SĐT
 * @param {string} matKhau - Mật khẩu plaintext
 * @returns {Promise<{ user, sessionData }>}
 */
async function login(identifier, matKhau) {
  // Tìm user theo email hoặc sdt
  const [rows] = await pool.query(
    `SELECT KhachHangId, MaKhachHang, HoTen, Email, SoDienThoai, 
            MatKhauHash, VaiTro, TrangThai, is_active, CapDoVIP
     FROM KhachHang 
     WHERE (Email = ? OR SoDienThoai = ?) AND is_active = 1
     LIMIT 1`,
    [identifier, identifier]
  );
  
  if (rows.length === 0) {
    throw new Error(MSG.AUTH.LOGIN_FAIL);
  }
  
  const user = rows[0];
  
  // Verify password
  const valid = await comparePassword(matKhau, user.MatKhauHash);
  if (!valid) {
    throw new Error(MSG.AUTH.LOGIN_FAIL);
  }
  
  // Check status
  if (user.TrangThai !== 'DangLam') {
    throw new Error(MSG.AUTH.ACCOUNT_LOCKED);
  }
  
  // Prepare session data (không gửi hash về client)
  const sessionData = {
    userId: user.KhachHangId,
    userCode: user.MaKhachHang,
    userName: user.HoTen,
    userRole: user.VaiTro || ROLES.CUSTOMER,
    userEmail: user.Email,
    loyaltyTier: user.CapDoVIP,
  };
  
  // Remove sensitive fields
  delete user.MatKhauHash;
  
  return { user, sessionData };
}

/**
 * Cập nhật thông tin profile
 * @param {number} userId 
 * @param {Object} updates - { hoTen, email?, sdt? }
 * @returns {Promise<boolean>}
 */
async function updateProfile(userId, updates) {
  const { hoTen, email, sdt } = updates;
  const fields = [];
  const params = [];
  
  if (hoTen) { fields.push('HoTen = ?'); params.push(hoTen); }
  if (email) { fields.push('Email = ?'); params.push(email); }
  if (sdt) { fields.push('SoDienThoai = ?'); params.push(sdt); }
  
  if (fields.length === 0) return true;
  
  params.push(userId);
  
  const [result] = await pool.query(
    `UPDATE KhachHang SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
     WHERE KhachHangId = ? AND is_active = 1`,
    params
  );
  
  return result.affectedRows > 0;
}

module.exports = { register, login, updateProfile };
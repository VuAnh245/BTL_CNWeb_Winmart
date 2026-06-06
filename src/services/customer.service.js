'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode } = require('../utils/generateCode');
const { hashPassword } = require('../utils/hash');
const { calcTier } = require('../utils/loyaltyCalc');
const { LOYALTY_TIER } = require('../constants/loyaltyTier');
const { MSG, format } = require('../constants/messages');
const appConfig = require('../config/app.config');

async function getAll(filters = {}, pagination = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'kh' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['HoTen', 'TongDiemTichLuy', 'NgayTao']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM KhachHang kh ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT kh.*, 
       (SELECT COUNT(*) FROM HoaDonBanHang hd WHERE hd.KhachHangId = kh.KhachHangId) as soDonHang,
       (SELECT SUM(TongTienSauKM) FROM HoaDonBanHang hd WHERE hd.KhachHangId = kh.KhachHangId AND hd.TrangThai = 'Completed') as tongChiTieu
     FROM KhachHang kh ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

async function getById(khachHangId) {
  const [rows] = await pool.query(
    `SELECT kh.*,
     (SELECT SUM(TongTienSauKM) FROM HoaDonBanHang hd WHERE hd.KhachHangId = kh.KhachHangId AND hd.TrangThai = 'Completed') as TongChiTieu
     FROM KhachHang kh 
     WHERE kh.KhachHangId = ? AND kh.is_active = 1`,
    [khachHangId]
  );
  
  const customer = rows[0];
  if (!customer) return null;
  
  const [orders] = await pool.query(
    `SELECT hd.MaHoaDon as maHD, hd.NgayLap as ngay, hd.TongTienSauKM as tong, hd.TrangThai as status 
     FROM HoaDonBanHang hd 
     WHERE hd.KhachHangId = ? 
     ORDER BY hd.NgayLap DESC 
     LIMIT 10`,
    [khachHangId]
  );
  
  customer.recentOrders = orders || [];
  
  return customer;
}

async function getByPhone(soDienThoai) {
  const [rows] = await pool.query(
    'SELECT * FROM KhachHang WHERE SoDienThoai = ? AND is_active = 1 LIMIT 1',
    [soDienThoai]
  );
  return rows[0] || null;
}

async function create(data, adminId) {
  const { HoTen, SoDienThoai, Email, MatKhau, CapDoVIP } = data;
  
  // Validate unique
  if (SoDienThoai) {
    const [exists] = await pool.query(
      'SELECT 1 FROM KhachHang WHERE SoDienThoai = ? AND is_active = 1',
      [SoDienThoai]
    );
    if (exists.length > 0) throw new Error(MSG.AUTH.PHONE_EXISTED);
  }
  
  if (Email) {
    const [exists] = await pool.query(
      'SELECT 1 FROM KhachHang WHERE Email = ? AND is_active = 1',
      [Email]
    );
    if (exists.length > 0) throw new Error(MSG.AUTH.EMAIL_EXISTED);
  }
  
  const MaKhachHang = generateCode('KH', 6);
  
  // Tạo pass ngẫu nhiên nếu không truyền
  let finalPassword = MatKhau;
  if (!finalPassword) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      finalPassword = '';
      for (let i = 0; i < 6; i++) {
          finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
  }

  const matKhauHash = await hashPassword(finalPassword);
  
  const [result] = await pool.query(
    `INSERT INTO KhachHang 
     (MaKhachHang, HoTen, SoDienThoai, Email, MatKhauHash, CapDoVIP, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [MaKhachHang, HoTen, SoDienThoai || null, Email || null, matKhauHash, CapDoVIP || LOYALTY_TIER.THUONG]
  );

  if (Email) {
      const emailService = require('./email.service');
      const customerData = { HoTen, SoDienThoai, Email };
      // Gửi mail bất đồng bộ (không block flow)
      emailService.sendNewAccountEmail(Email, customerData, finalPassword).catch(err => console.error(err));
  }
  
  return { khachHangId: result.insertId, maKhachHang: MaKhachHang };
}

async function update(khachHangId, updates, adminId) {
  const { HoTen, SoDienThoai, Email, CapDoVIP } = updates;
  
  if (SoDienThoai) {
    const [exists] = await pool.query(
      'SELECT 1 FROM KhachHang WHERE SoDienThoai = ? AND KhachHangId != ? AND is_active = 1',
      [SoDienThoai, khachHangId]
    );
    if (exists.length > 0) throw new Error(MSG.AUTH.PHONE_EXISTED);
  }
  
  if (Email) {
    const [exists] = await pool.query(
      'SELECT 1 FROM KhachHang WHERE Email = ? AND KhachHangId != ? AND is_active = 1',
      [Email, khachHangId]
    );
    if (exists.length > 0) throw new Error(MSG.AUTH.EMAIL_EXISTED);
  }
  
  const fields = [];
  const params = [];
  
  if (HoTen) { fields.push('HoTen = ?'); params.push(HoTen); }
  if (SoDienThoai !== undefined) { fields.push('SoDienThoai = ?'); params.push(SoDienThoai); }
  if (Email !== undefined) { fields.push('Email = ?'); params.push(Email); }
  if (CapDoVIP) { fields.push('CapDoVIP = ?'); params.push(CapDoVIP); }
  
  if (fields.length === 0) return true;
  
  params.push(khachHangId);
  
  const [result] = await pool.query(
    `UPDATE KhachHang SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
     WHERE KhachHangId = ? AND is_active = 1`,
    params
  );
  
  return result.affectedRows > 0;
}

async function softDelete(khachHangId, adminId) {
  // Không xóa khách đã có đơn hàng
  const [orders] = await pool.query(
    'SELECT 1 FROM HoaDonBanHang WHERE KhachHangId = ? LIMIT 1',
    [khachHangId]
  );
  
  if (orders.length > 0) {
    // Chỉ ẩn, không xóa
    const [result] = await pool.query(
      'UPDATE KhachHang SET is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
      [khachHangId]
    );
    return result.affectedRows > 0;
  }
  
  const [result] = await pool.query(
    'UPDATE KhachHang SET is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
    [khachHangId]
  );
  
  return result.affectedRows > 0;
}

async function toggleStatus(khachHangId, adminId) {
  const [customer] = await pool.query(
    'SELECT is_active FROM KhachHang WHERE KhachHangId = ?',
    [khachHangId]
  );
  if (!customer.length) throw new Error('Không tìm thấy khách hàng');
  
  const newStatus = customer[0].is_active ? 0 : 1;
  const [result] = await pool.query(
    'UPDATE KhachHang SET is_active = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
    [newStatus, khachHangId]
  );
  return { success: result.affectedRows > 0, newStatus };
}

/**
 * Admin điều chỉnh điểm thủ công (có audit)
 */
async function adjustPoints(khachHangId, delta, lyDo, adminId) {
  if (!lyDo?.trim()) {
    throw new Error('Bắt buộc ghi lý do điều chỉnh điểm');
  }
  
  return withTransaction(async (conn) => {
    const [customer] = await conn.query(
      'SELECT TongDiemTichLuy, CapDoVIP FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
      [khachHangId]
    );
    
    if (!customer.length) throw new Error('Khách hàng không tồn tại');
    
    const currentBalance = customer[0].TongDiemTichLuy || 0;
    const newBalance = Math.max(0, currentBalance + delta);
    const newTier = calcTier(newBalance);
    
    // Insert audit log
    const maGiaoDich = generateCode('GD', 6);
    await conn.query(
      `INSERT INTO DiemTichLuy 
       (MaGiaoDich, KhachHangId, LoaiGiaoDich, SoDiemThayDoi, SoDiemSauGiaoDich, GhiChu, NhanVienId)
       VALUES (?, ?, 'DieuChinh', ?, ?, ?, ?)`,
      [maGiaoDich, khachHangId, delta, newBalance, lyDo, adminId]
    );
    
    // Update customer
    await conn.query(
      `UPDATE KhachHang 
       SET TongDiemTichLuy = ?, CapDoVIP = ?, NgayCapNhat = CURRENT_TIMESTAMP 
       WHERE KhachHangId = ?`,
      [newBalance, newTier, khachHangId]
    );
    
    return {
      previousBalance: currentBalance,
      newBalance,
      previousTier: customer[0].CapDoVIP,
      newTier,
      upgraded: newTier !== customer[0].CapDoVIP,
    };
  });
}

/**
 * Recalculate tier cho tất cả khách (cron job hàng tháng)
 */
async function recalculateAllTiers() {
  const [customers] = await pool.query(
    'SELECT KhachHangId, TongDiemTichLuy, CapDoVIP FROM KhachHang WHERE is_active = 1'
  );
  
  let updated = 0;
  
  for (const c of customers) {
    const newTier = calcTier(c.TongDiemTichLuy);
    if (newTier !== c.CapDoVIP) {
      await pool.query(
        'UPDATE KhachHang SET CapDoVIP = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
        [newTier, c.KhachHangId]
      );
      updated++;
    }
  }
  
  console.log(`[Loyalty] Updated ${updated} customer tiers`);
  return updated;
}

module.exports = {
  getAll,
  getById,
  getByPhone,
  create,
  update,
  softDelete,
  toggleStatus,
  adjustPoints,
  recalculateAllTiers,
};
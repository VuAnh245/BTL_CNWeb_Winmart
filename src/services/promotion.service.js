'use strict';

const { pool } = require('../config/db');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode } = require('../utils/generateCode');
const { MSG, format } = require('../constants/messages');

/**
 * Validate mã giảm giá trước khi áp dụng
 * @param {string} maCode - Mã khách nhập (VD: SUMMER24)
 * @param {number} orderTotal - Tổng đơn trước KM
 * @param {number|null} khachHangId - Optional: để check giới hạn theo KH
 * @returns {Promise<Object>} { discountType, discountValue, finalDiscount }
 */
async function validateCode(maCode, orderTotal, khachHangId = null) {
  const now = new Date();
  
  const [promos] = await pool.query(
    `SELECT * FROM MaGiamGia 
     WHERE MaCode = ? AND is_active = 1 AND TrangThai = 'HieuLuc'
     AND NgayBatDau <= ? AND NgayKetThuc >= ?
     AND (GioiHanSuDung IS NULL OR SoLanDaSuDung < GioiHanSuDung)
     LIMIT 1`,
    [maCode, now, now]
  );
  
  if (promos.length === 0) {
    const error = new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    error.code = 'PROMO_INVALID';
    throw error;
  }
  
  const promo = promos[0];
  
  // Check min order value
  if (orderTotal < promo.GiaTriDonHangToiThieu) {
    const error = new Error(`Đơn hàng tối thiểu ${promo.GiaTriDonHangToiThieu.toLocaleString('vi-VN')}₫ để áp mã này`);
    error.code = 'PROMO_MIN_ORDER';
    throw error;
  }
  
  // Check usage limit per customer (nếu có logic này)
  if (khachHangId && promo.GioiHanSuDung) {
    const [usage] = await pool.query(
      `SELECT COUNT(*) as count FROM HoaDonBanHang 
       WHERE KhachHangId = ? AND MaGiamGiaId = ? AND TrangThai != 'Cancelled'`,
      [khachHangId, promo.MaGiamGiaId]
    );
    
    if (usage[0].count >= promo.GioiHanSuDung) {
      const error = new Error('Bạn đã sử dụng mã này tối đa số lần cho phép');
      error.code = 'PROMO_LIMIT_REACHED';
      throw error;
    }
  }
  
  // Calculate discount amount
  let discountValue = 0;
  
  if (promo.LoaiGiamGia === 'PhanTram') {
    discountValue = orderTotal * (promo.GiaTri / 100);
    // Cap at PhanTramToiDa nếu có
    if (promo.PhanTramToiDa) {
      const maxDiscount = orderTotal * (promo.PhanTramToiDa / 100);
      discountValue = Math.min(discountValue, maxDiscount);
    }
  } else {
    // GiaTri: giảm trực tiếp số tiền
    discountValue = Math.min(promo.GiaTri, orderTotal); // Không giảm âm
  }
  
  return {
    promoId: promo.MaGiamGiaId,
    maCode: promo.MaCode,
    tenMa: promo.TenMaGiamGia,
    discountType: promo.LoaiGiamGia,
    discountValue: Math.floor(discountValue),
    message: `Áp dụng thành công: ${promo.TenMaGiamGia}`,
  };
}

/**
 * Lấy danh sách khuyến mãi đang hiệu lực
 */
async function getAllActive(filters = {}, pagination = {}) {
  const now = new Date();
  filters.NgayBatDau = { op: '<=', value: now };
  filters.NgayKetThuc = { op: '>=', value: now };
  filters.TrangThai = 'HieuLuc';
  filters.is_active = 1;
  
  return getAll(filters, pagination);
}

async function getAll(filters = {}, pagination = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'mgg' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['TenMaGiamGia', 'NgayBatDau']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM MaGiamGia mgg ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT mgg.*, 
       (SELECT COUNT(*) FROM HoaDonBanHang hd WHERE hd.MaGiamGiaId = mgg.MaGiamGiaId) as soLanSuDung
     FROM MaGiamGia mgg ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  // Add computed fields
  const items = rows.map(r => ({
    ...r,
    conLai: r.GioiHanSuDung ? r.GioiHanSuDung - r.SoLanDaSuDung : null,
    isExpired: new Date(r.NgayKetThuc) < new Date(),
  }));
  
  return { items, meta: meta(total) };
}

async function getById(maGiamGiaId) {
  const [rows] = await pool.query(
    'SELECT * FROM MaGiamGia WHERE MaGiamGiaId = ? AND is_active = 1',
    [maGiamGiaId]
  );
  return rows[0] || null;
}

async function create(data, adminId) {
  const {
    MaCode, TenMaGiamGia, LoaiGiamGia, GiaTri, PhanTramToiDa,
    GiaTriDonHangToiThieu, NgayBatDau, NgayKetThuc, GioiHanSuDung
  } = data;
  
  // Validate unique code
  const [exists] = await pool.query(
    'SELECT 1 FROM MaGiamGia WHERE MaCode = ? AND is_active = 1',
    [MaCode]
  );
  if (exists.length > 0) throw new Error('Mã khuyến mãi đã tồn tại');
  
  // Validate date range
  if (new Date(NgayKetThuc) < new Date(NgayBatDau)) {
    throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
  }
  
  // Validate percent range
  if (LoaiGiamGia === 'PhanTram' && (PhanTramToiDa < 0 || PhanTramToiDa > 100)) {
    throw new Error('Phần trăm tối đa phải từ 0-100');
  }
  
  const [result] = await pool.query(
    `INSERT INTO MaGiamGia 
     (MaCode, TenMaGiamGia, LoaiGiamGia, GiaTri, PhanTramToiDa,
      GiaTriDonHangToiThieu, NgayBatDau, NgayKetThuc, GioiHanSuDung, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      MaCode, TenMaGiamGia, LoaiGiamGia, GiaTri, PhanTramToiDa || null,
      GiaTriDonHangToiThieu || 0, NgayBatDau, NgayKetThuc, GioiHanSuDung || null
    ]
  );
  return { maGiamGiaId: result.insertId, maCode: MaCode };
}

async function update(maGiamGiaId, updates, adminId) {
  const { TenMaGiamGia, GiaTri, PhanTramToiDa, GiaTriDonHangToiThieu, NgayBatDau, NgayKetThuc, GioiHanSuDung, TrangThai } = updates;
  
  if (NgayBatDau && NgayKetThuc && new Date(NgayKetThuc) < new Date(NgayBatDau)) {
    throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
  }
  
  const fields = [];
  const params = [];
  
  if (TenMaGiamGia) { fields.push('TenMaGiamGia = ?'); params.push(TenMaGiamGia); }
  if (GiaTri !== undefined) { fields.push('GiaTri = ?'); params.push(GiaTri); }
  if (PhanTramToiDa !== undefined) { fields.push('PhanTramToiDa = ?'); params.push(PhanTramToiDa); }
  if (GiaTriDonHangToiThieu !== undefined) { fields.push('GiaTriDonHangToiThieu = ?'); params.push(GiaTriDonHangToiThieu); }
  if (NgayBatDau) { fields.push('NgayBatDau = ?'); params.push(NgayBatDau); }
  if (NgayKetThuc) { fields.push('NgayKetThuc = ?'); params.push(NgayKetThuc); }
  if (GioiHanSuDung !== undefined) { fields.push('GioiHanSuDung = ?'); params.push(GioiHanSuDung); }
  
  if (TrangThai) { 
      fields.push('TrangThai = ?'); 
      params.push(TrangThai); 
  } else if (NgayKetThuc) {
      // Tự động kiểm tra và mở khóa lại nếu gia hạn thời gian
      if (new Date(NgayKetThuc) >= new Date()) {
          fields.push('TrangThai = ?');
          params.push('HieuLuc');
      }
  }
  
  if (fields.length === 0) return true;
  
  params.push(maGiamGiaId);
  
  const [result] = await pool.query(
    `UPDATE MaGiamGia SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
     WHERE MaGiamGiaId = ? AND is_active = 1`,
    params
  );
  
  return result.affectedRows > 0;
}

async function softDelete(maGiamGiaId, adminId) {
  const [result] = await pool.query(
    'UPDATE MaGiamGia SET is_active = 0, TrangThai = "HetHieuLuc", NgayCapNhat = CURRENT_TIMESTAMP WHERE MaGiamGiaId = ?',
    [maGiamGiaId]
  );
  return result.affectedRows > 0;
}

/**
 * Increment usage count when order is completed
 */
async function incrementUsage(maGiamGiaId, conn = pool) {
  const [result] = await conn.query(
    'UPDATE MaGiamGia SET SoLanDaSuDung = SoLanDaSuDung + 1, NgayCapNhat = CURRENT_TIMESTAMP WHERE MaGiamGiaId = ?',
    [maGiamGiaId]
  );
  return result.affectedRows > 0;
}

/**
 * Cron job: Auto-expire promotions past end date
 */
async function autoExpirePromotions() {
  const now = new Date();
  const [result] = await pool.query(
    `UPDATE MaGiamGia 
     SET TrangThai = 'HetHieuLuc', NgayCapNhat = CURRENT_TIMESTAMP 
     WHERE is_active = 1 AND TrangThai = 'HieuLuc' AND NgayKetThuc < ?`,
    [now]
  );
  
  if (result.affectedRows > 0) {
    console.log(`[Promotion] Auto-expired ${result.affectedRows} promotions`);
  }
  return result.affectedRows;
}

/**
 * Lấy tất cả mã giảm giá đang hoạt động (dành cho trang chủ)
 */
async function getAllActiveFlashSales() {
  try {
    // Cập nhật trạng thái trước khi query
    await autoExpirePromotions();

    const query = `
      SELECT * FROM MaGiamGia 
      WHERE is_active = 1 
      AND TrangThai = 'HieuLuc' 
      AND NgayBatDau <= NOW()
      AND NgayKetThuc > NOW()
      ORDER BY NgayKetThuc ASC 
    `;
    const [rows] = await pool.query(query);
    return rows;
  } catch (error) {
    console.error('Error in getAllActiveFlashSales:', error);
    return [];
  }
}

module.exports = {
  validateCode,
  getAllActive,
  getAll,
  getById,
  create,
  update,
  softDelete,
  incrementUsage,
  autoExpirePromotions,
  getAllActiveFlashSales
};
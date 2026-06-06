'use strict';

const { pool } = require('../config/db');
const { generateCode } = require('../utils/generateCode');
const { calcEarnPoints, calcTier, pointsToMoney } = require('../utils/loyaltyCalc');
const { LOYALTY_TIER, LOYALTY_THRESHOLD, LOYALTY_BONUS } = require('../constants/loyaltyTier');
const { MSG, format } = require('../constants/messages');
const appConfig = require('../config/app.config');

/**
 * Cộng điểm tích lũy cho khách hàng
 * @param {number} khachHangId 
 * @param {number} points - Số điểm cộng (luôn dương)
 * @param {number|null} hoaDonId - Optional: liên kết hóa đơn
 * @param {string} ghiChu 
 * @param {Connection} conn - Optional: dùng trong transaction
 * @returns {Promise<{ newBalance, newTier }>}
 */
async function earnPoints(khachHangId, points, hoaDonId = null, ghiChu = '', conn = null) {
  const executor = conn || pool;
  
  if (points <= 0) {
    throw new Error('Số điểm phải lớn hơn 0');
  }
  
  // Get current balance
  const [customer] = await executor.query(
    'SELECT TongDiemTichLuy, CapDoVIP FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
    [khachHangId]
  );
  
  if (customer.length === 0) {
    throw new Error('Khách hàng không tồn tại');
  }
  
  const currentBalance = customer[0].TongDiemTichLuy || 0;
  const newBalance = currentBalance + points;
  
  // Insert transaction log
  const maGiaoDich = generateCode('GD', 6);
  await executor.query(
    `INSERT INTO DiemTichLuy 
     (MaGiaoDich, KhachHangId, HoaDonId, LoaiGiaoDich, 
      SoDiemThayDoi, SoDiemSauGiaoDich, GhiChu)
     VALUES (?, ?, ?, 'TichDiem', ?, ?, ?)`,
    [maGiaoDich, khachHangId, hoaDonId, points, newBalance, ghiChu]
  );
  
  // Update customer balance
  await executor.query(
    'UPDATE KhachHang SET TongDiemTichLuy = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
    [newBalance, khachHangId]
  );
  
  return { newBalance, newTier: customer[0].CapDoVIP };
}

/**
 * Trừ điểm khi khách dùng để thanh toán
 * @param {number} khachHangId 
 * @param {number} points - Số điểm trừ (luôn dương)
 * @param {number} hoaDonId 
 * @param {string} ghiChu 
 * @param {Connection} conn 
 */
async function deductPoints(khachHangId, points, hoaDonId, ghiChu = '', conn = null) {
  const executor = conn || pool;
  
  // Get current balance
  const [customer] = await executor.query(
    'SELECT TongDiemTichLuy FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
    [khachHangId]
  );
  
  if (customer.length === 0 || customer[0].TongDiemTichLuy < points) {
    throw new Error(MSG.LOYALTY.POINTS_NOT_ENOUGH.replace('{needed}', points - (customer[0]?.TongDiemTichLuy || 0)));
  }
  
  const newBalance = customer[0].TongDiemTichLuy - points;
  
  // Insert transaction log
  const maGiaoDich = generateCode('GD', 6);
  await executor.query(
    `INSERT INTO DiemTichLuy 
     (MaGiaoDich, KhachHangId, HoaDonId, LoaiGiaoDich, 
      SoDiemThayDoi, SoDiemSauGiaoDich, GhiChu)
     VALUES (?, ?, ?, 'SuDungDiem', -?, ?, ?)`,
    [maGiaoDich, khachHangId, hoaDonId, points, newBalance, ghiChu]
  );
  
  // Update balance
  await executor.query(
    'UPDATE KhachHang SET TongDiemTichLuy = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
    [newBalance, khachHangId]
  );
}

/**
 * Hoàn điểm khi hủy đơn
 * @param {number} khachHangId 
 * @param {number} points 
 * @param {number} hoaDonId 
 * @param {string} ghiChu 
 * @param {Connection} conn 
 */
async function refundPoints(khachHangId, points, hoaDonId, ghiChu = '', conn = null) {
  // Re-use earnPoints but with different LoaiGiaoDich
  const executor = conn || pool;
  
  const [customer] = await executor.query(
    'SELECT TongDiemTichLuy FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
    [khachHangId]
  );
  
  if (customer.length === 0) {
    throw new Error('Khách hàng không tồn tại');
  }
  
  const newBalance = (customer[0].TongDiemTichLuy || 0) + points;
  
  const maGiaoDich = generateCode('GD', 6);
  await executor.query(
    `INSERT INTO DiemTichLuy 
     (MaGiaoDich, KhachHangId, HoaDonId, LoaiGiaoDich, 
      SoDiemThayDoi, SoDiemSauGiaoDich, GhiChu)
     VALUES (?, ?, ?, 'DieuChinh', ?, ?, ?)`,
    [maGiaoDich, khachHangId, hoaDonId, points, newBalance, `Hoàn điểm: ${ghiChu}`]
  );
  
  await executor.query(
    'UPDATE KhachHang SET TongDiemTichLuy = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
    [newBalance, khachHangId]
  );
}

/**
 * Admin điều chỉnh điểm thủ công (có audit)
 * @param {number} khachHangId 
 * @param {number} delta - Dương: cộng, Âm: trừ
 * @param {string} lyDo - Bắt buộc
 * @param {string} adminId - Người thực hiện
 */
async function adjustPoints(khachHangId, delta, lyDo, adminId) {
  if (!lyDo?.trim()) {
    throw new Error('Bắt buộc ghi lý do điều chỉnh điểm');
  }
  
  return withTransaction(async (conn) => {
    const [customer] = await conn.query(
      'SELECT TongDiemTichLuy FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
      [khachHangId]
    );
    
    if (customer.length === 0) {
      throw new Error('Khách hàng không tồn tại');
    }
    
    const currentBalance = customer[0].TongDiemTichLuy || 0;
    const newBalance = Math.max(0, currentBalance + delta); // Không cho âm
    
    const maGiaoDich = generateCode('GD', 6);
    await conn.query(
      `INSERT INTO DiemTichLuy 
       (MaGiaoDich, KhachHangId, LoaiGiaoDich, SoDiemThayDoi, 
        SoDiemSauGiaoDich, GhiChu, NhanVienId)
       VALUES (?, ?, 'DieuChinh', ?, ?, ?, ?)`,
      [maGiaoDich, khachHangId, delta, newBalance, lyDo, adminId]
    );
    
    await conn.query(
      'UPDATE KhachHang SET TongDiemTichLuy = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
      [newBalance, khachHangId]
    );
    
    return { previousBalance: currentBalance, newBalance };
  });
}

/**
 * Tính số điểm tối đa có thể dùng cho đơn hàng
 * Rule: Không quá 50% giá trị đơn + không vượt số điểm hiện có
 */
async function getMaxUsablePoints(khachHangId, orderTotal, conn = null) {
  const executor = conn || pool;
  
  const [customer] = await executor.query(
    'SELECT TongDiemTichLuy FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
    [khachHangId]
  );
  
  if (!customer.length) return 0;
  
  const availablePoints = customer[0].TongDiemTichLuy || 0;
  const maxByOrder = Math.floor(orderTotal * 0.5); // 50% rule
  
  return Math.min(availablePoints, maxByOrder);
}

/**
 * Kiểm tra và nâng hạng VIP tự động sau giao dịch
 * @param {number} khachHangId 
 * @param {Connection} conn 
 * @returns {Promise<{ upgraded: boolean, newTier: string }>}
 */
async function checkAndUpgradeTier(khachHangId, conn = null) {
  const executor = conn || pool;
  
  const [customer] = await executor.query(
    'SELECT TongDiemTichLuy, CapDoVIP FROM KhachHang WHERE KhachHangId = ? AND is_active = 1',
    [khachHangId]
  );
  
  if (!customer.length) return { upgraded: false, newTier: null };
  
  const currentTier = customer[0].CapDoVIP;
  const newTier = calcTier(customer[0].TongDiemTichLuy);
  
  if (newTier !== currentTier) {
    await executor.query(
      'UPDATE KhachHang SET CapDoVIP = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE KhachHangId = ?',
      [newTier, khachHangId]
    );
    
    // Log upgrade event
    const maGiaoDich = generateCode('GD', 6);
    await executor.query(
      `INSERT INTO DiemTichLuy 
       (MaGiaoDich, KhachHangId, LoaiGiaoDich, SoDiemThayDoi, SoDiemSauGiaoDich, GhiChu)
       VALUES (?, ?, 'DieuChinh', 0, ?, ?)`,
      [maGiaoDich, khachHangId, customer[0].TongDiemTichLuy, `Tự động nâng hạng: ${currentTier} → ${newTier}`]
    );
    
    return { upgraded: true, newTier, previousTier: currentTier };
  }
  
  return { upgraded: false, newTier: currentTier };
}

/**
 * Lấy lịch sử giao dịch điểm của khách
 * @param {number} khachHangId 
 * @param {Object} filters - { page, limit, loaiGiaoDich, dateFrom, dateTo }
 */
async function getLoyaltyHistory(khachHangId, filters = {}) {
  const { page = 1, limit = 20, loaiGiaoDich, dateFrom, dateTo } = filters;
  const offset = (page - 1) * limit;
  
  const conditions = ['dl.KhachHangId = ?'];
  const params = [khachHangId];
  
  if (loaiGiaoDich) {
    conditions.push('dl.LoaiGiaoDich = ?');
    params.push(loaiGiaoDich);
  }
  if (dateFrom) {
    conditions.push('dl.NgayGiaoDich >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('dl.NgayGiaoDich <= ?');
    params.push(dateTo);
  }
  
  const whereClause = conditions.join(' AND ');
  
  // Get total count
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM DiemTichLuy dl WHERE ${whereClause}`,
    params
  );
  
  // Get records
  const [rows] = await pool.query(
    `SELECT 
       dl.MaGiaoDich, dl.LoaiGiaoDich, dl.SoDiemThayDoi, dl.SoDiemSauGiaoDich,
       dl.GhiChu, dl.NgayGiaoDich,
       hd.MaHoaDon, hd.TongTienSauKM
     FROM DiemTichLuy dl
     LEFT JOIN HoaDonBanHang hd ON dl.HoaDonId = hd.HoaDonId
     WHERE ${whereClause}
     ORDER BY dl.NgayGiaoDich DESC, dl.GiaoDichId DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return {
    items: rows,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  earnPoints,
  deductPoints,
  refundPoints,
  adjustPoints,
  getMaxUsablePoints,
  checkAndUpgradeTier,
  getLoyaltyHistory,
};
'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { MSG } = require('../constants/messages');

/**
 * Mở ca mới cho nhân viên
 */
async function openShift(nhanVienId, data) {
  const { SoTienBanDau, GhiChu } = data;
  
  // Check if already has open shift
  const [open] = await pool.query(
    'SELECT * FROM Shift WHERE NhanVienId = ? AND TrangThai = "Open"',
    [nhanVienId]
  );
  
  if (open.length > 0) {
    throw new Error('Bạn đã có ca làm việc đang mở. Vui lòng đóng ca trước khi mở ca mới.');
  }
  
  const [result] = await pool.query(
    `INSERT INTO Shift 
     (NhanVienId, SoTienBanDau, TrangThai, GhiChu)
     VALUES (?, ?, 'Open', ?)`,
    [nhanVienId, SoTienBanDau || 0, GhiChu || null]
  );
  
  return { shiftId: result.insertId, message: 'Đã mở ca thành công' };
}

/**
 * Đóng ca & tính toán doanh thu
 */
async function closeShift(shiftId, data, adminId = null) {
  const { SoTienCuoiKy, GhiChu } = data;
  
  return withTransaction(async (conn) => {
    // Get shift info
    const [shifts] = await conn.query(
      'SELECT * FROM Shift WHERE ShiftId = ? AND TrangThai = "Open"',
      [shiftId]
    );
    
    if (shifts.length === 0) {
      throw new Error('Ca làm việc không tồn tại hoặc đã đóng');
    }
    
    const shift = shifts[0];
    
    // Calculate actual sales from orders in this shift
    const [sales] = await conn.query(
      `SELECT 
         COUNT(*) as soDon,
         SUM(TongTienSauKM) as tongDoanhThu,
         SUM(CASE WHEN PhuongThucTT = 'TienMat' THEN TongTienSauKM ELSE 0 END) as tienMat,
         SUM(CASE WHEN PhuongThucTT IN ('ChuyenKhoan', 'QR') THEN TongTienSauKM ELSE 0 END) as tienCK
       FROM HoaDonBanHang 
       WHERE NhanVienId = ? 
         AND NgayLap BETWEEN ? AND NOW()
         AND TrangThai IN ('Paid', 'Completed')`,
      [shift.NhanVienId, shift.NgayMo]
    );
    
    const tongBanDau = shift.SoTienBanDau || 0;
    const tongCuoiKy = SoTienCuoiKy || 0;
    const tongDoanhThu = sales[0].tongDoanhThu || 0;
    const tienMatThu = sales[0].tienMat || 0;
    
    // Calculate variance
    const tienMatLyThuyet = tongBanDau + tienMatThu;
    const chechLech = tongCuoiKy - tienMatLyThuyet;
    
    // Update shift
    const [result] = await conn.query(
      `UPDATE Shift 
       SET SoTienCuoiKy = ?, TongDoanhThu = ?, ChechLech = ?,
           TrangThai = 'Closed', GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[Đóng] ', ?),
           NgayDong = CURRENT_TIMESTAMP, NguoiDong = ?
       WHERE ShiftId = ?`,
      [tongCuoiKy, tongDoanhThu, chechLech, GhiChu || '', adminId || shift.NhanVienId, shiftId]
    );
    
    return {
      shiftId,
      soDon: sales[0].soDon,
      tongDoanhThu,
      tienMatThu,
      tienBanDau: tongBanDau,
      tienCuoiKy: tongCuoiKy,
      chechLech,
      message: chechLech === 0 ? 'Đóng ca thành công. Không chênh lệch.' 
                               : `Đóng ca thành công. Chênh lệch: ${chechLech.toLocaleString('vi-VN')}₫`,
    };
  });
}

/**
 * Lấy thông tin ca hiện tại của nhân viên
 */
async function getCurrentShift(nhanVienId) {
  const [rows] = await pool.query(
    `SELECT s.*, nv.HoTen as tenNhanVien,
       (SELECT COUNT(*) FROM HoaDonBanHang 
        WHERE NhanVienId = s.NhanVienId 
          AND NgayLap BETWEEN s.NgayMo AND IF(s.NgayDong, s.NgayDong, NOW())
          AND TrangThai IN ('Paid', 'Completed')) as soDonTrongCa
     FROM Shift s
     JOIN NhanVien nv ON s.NhanVienId = nv.NhanVienId
     WHERE s.NhanVienId = ? AND s.TrangThai = 'Open'
     ORDER BY s.NgayMo DESC LIMIT 1`,
    [nhanVienId]
  );
  
  return rows[0] || null;
}

/**
 * Admin: Xem lịch sử ca làm việc
 */
async function getShiftHistory(filters = {}, pagination = {}) {
  const { buildWhere } = require('../utils/queryBuilder');
  const { paginate } = require('../utils/pagination');
  
  const { where, params } = buildWhere(filters, { tableAlias: 's' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM Shift s ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT 
       s.*, nv.HoTen as tenNhanVien,
       admin.HoTen as tenNguoiDong
     FROM Shift s
     JOIN NhanVien nv ON s.NhanVienId = nv.NhanVienId
     LEFT JOIN NhanVien admin ON s.NguoiDong = admin.NhanVienId
     ${where} ORDER BY s.NgayMo DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

module.exports = {
  openShift,
  closeShift,
  getCurrentShift,
  getShiftHistory,
};
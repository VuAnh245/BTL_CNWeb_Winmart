'use strict';

const { pool } = require('../config/db');
const appConfig = require('../config/app.config');

/**
 * Dashboard metrics cho Admin/Staff
 */
async function getDashboardMetrics(storeId = 1, dateRange = 'today') {
  let dateCondition = '';
  const params = [];
  
  switch (dateRange) {
    case 'today':
      dateCondition = 'DATE(hd.NgayLap) = CURDATE()';
      break;
    case 'week':
      dateCondition = 'hd.NgayLap >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
      break;
    case 'month':
      dateCondition = 'hd.NgayLap >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
      break;
    default:
      dateCondition = '1=1';
  }
  
  const [metrics] = await pool.query(
    `SELECT 
       COUNT(CASE WHEN hd.TrangThai IN ('Paid', 'Completed') THEN 1 END) as soDonThanhCong,
       COUNT(CASE WHEN hd.TrangThai = 'Pending' THEN 1 END) as soDonCho,
       SUM(CASE WHEN hd.TrangThai IN ('Paid', 'Completed') THEN hd.TongTienSauKM END) as doanhThu,
       SUM(CASE WHEN hd.TrangThai IN ('Paid', 'Completed') THEN 
         (SELECT SUM(cthd.SoLuong) FROM ChiTietHoaDon cthd WHERE cthd.HoaDonId = hd.HoaDonId)
       END) as tongSoLuongBan,
       COUNT(DISTINCT hd.KhachHangId) as soKhachHangMoi
     FROM HoaDonBanHang hd
     WHERE ${dateCondition}`,
    params
  );
  
  const m = metrics[0];
  
  // Get top products
  const [topProducts] = await pool.query(
    `SELECT 
       sp.TenSanPham, sp.MaSanPham,
       SUM(cthd.SoLuong) as tongBan,
       SUM(cthd.ThanhTienCuoi) as doanhThu
     FROM ChiTietHoaDon cthd
     JOIN SanPham sp ON cthd.SanPhamId = sp.SanPhamId
     JOIN HoaDonBanHang hd ON cthd.HoaDonId = hd.HoaDonId
     WHERE ${dateCondition} AND hd.TrangThai IN ('Paid', 'Completed')
     GROUP BY sp.SanPhamId
     ORDER BY tongBan DESC LIMIT 5`,
    params
  );
  
  // Get low stock alerts
  const [lowStock] = await pool.query(
    `SELECT 
       sp.TenSanPham, sp.MaSanPham, sp.MucCanDat,
       (SELECT SUM(SoLuongHienTai) FROM LoHangTonKho 
        WHERE SanPhamId = sp.SanPhamId AND TrangThai = 'Available') as tonKho
     FROM SanPham sp
     WHERE sp.is_active = 1 AND sp.TrangThai = 'DangBan'
     HAVING tonKho <= sp.MucCanDat OR tonKho IS NULL
     LIMIT 10`
  );
  
  // Get expiry warnings
  const expiryService = require('./batch.service');
  const expiryWarnings = await expiryService.getExpiryWarnings(storeId);
  
  return {
    summary: {
      soDonThanhCong: m.soDonThanhCong || 0,
      soDonCho: m.soDonCho || 0,
      doanhThu: m.doanhThu || 0,
      tongSoLuongBan: m.tongSoLuongBan || 0,
      soKhachHangMoi: m.soKhachHangMoi || 0,
    },
    topProducts,
    lowStockAlerts: lowStock,
    expiryWarnings: expiryWarnings.slice(0, 5), // Top 5
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Báo cáo doanh thu theo thời gian
 */
async function getRevenueReport(dateFrom, dateTo, groupBy = 'day') {
  const groupFormat = {
    day: '%Y-%m-%d',
    week: '%Y-%u', // ISO week
    month: '%Y-%m',
  };
  
  const format = groupFormat[groupBy] || groupFormat.day;
  
  const [rows] = await pool.query(
    `SELECT 
       DATE_FORMAT(NgayLap, ?) as period,
       COUNT(*) as soDon,
       SUM(TongTienSauKM) as doanhThu,
       SUM(TongTienTruocKM - TongTienSauKM) as tongGiamGia,
       COUNT(DISTINCT KhachHangId) as soKhach
     FROM HoaDonBanHang 
     WHERE TrangThai IN ('Paid', 'Completed')
       AND DATE(NgayLap) BETWEEN ? AND ?
     GROUP BY period
     ORDER BY period ASC`,
    [format, dateFrom, dateTo]
  );
  
  return rows;
}

/**
 * Báo cáo tồn kho chi tiết
 */
async function getInventoryReport(danhMucId = null) {
  const conditions = ['sp.is_active = 1', 'sp.TrangThai = "DangBan"'];
  const params = [];
  
  if (danhMucId) {
    conditions.push('sp.DanhMucId = ?');
    params.push(danhMucId);
  }
  
  const where = conditions.join(' AND ');
  
  const [rows] = await pool.query(
    `SELECT 
       sp.MaSanPham, sp.TenSanPham, dm.TenDanhMuc,
       sp.GiaBan, sp.GiaNhapGoc,
       COALESCE(SUM(lh.SoLuongHienTai), 0) as tongTon,
       COALESCE(SUM(CASE WHEN lh.NgayHetHan < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN lh.SoLuongHienTai END), 0) as tonCanDate,
       sp.MucCanDat
     FROM SanPham sp
     LEFT JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
     LEFT JOIN LoHangTonKho lh ON sp.SanPhamId = lh.SanPhamId AND lh.TrangThai = 'Available'
     WHERE ${where}
     GROUP BY sp.SanPhamId
     ORDER BY tongTon ASC`,
    params
  );
  
  return rows;
}

/**
 * Export report to CSV format
 */
function exportToCSV(data, columns) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const val = row[col.key];
      // Escape commas and quotes
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

module.exports = {
  getDashboardMetrics,
  getRevenueReport,
  getInventoryReport,
  exportToCSV,
};
'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { generateCode } = require('../utils/generateCode');
const { MSG, format } = require('../constants/messages');

/**
 * Tạo phiếu nhập hàng mới (chờ duyệt)
 */
async function createReceipt(data, nhanVienId) {
  const {
    NhaCungCapId, items, // [{ SanPhamId, SoLuong, GiaNhapDonVi, ThueVATDauVao, MaLo, NgayHetHan }]
    NgayNhapVe, GhiChu
  } = data;
  
  return withTransaction(async (conn) => {
    const MaPhieuNhap = generateCode('PN', 6);
    
    // Create header
    const [headerResult] = await conn.query(
      `INSERT INTO PhieuNhapHang 
       (MaPhieuNhap, NhaCungCapId, NhanVienId, NgayNhapVe, TrangThai, GhiChu)
       VALUES (?, ?, ?, ?, 'DangCho', ?)`,
      [MaPhieuNhap, NhaCungCapId, nhanVienId, NgayNhapVe || null, GhiChu || null]
    );
    
    const phieuNhapId = headerResult.insertId;
    
    // Create details (no stock update yet)
    for (const item of items) {
      await conn.query(
        `INSERT INTO ChiTietPhieuNhap 
         (PhieuNhapId, SanPhamId, MaLo, SoLuong, GiaNhapDonVi, ThueVATDauVao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          phieuNhapId, item.SanPhamId, item.MaLo, item.SoLuong, 
          item.GiaNhapDonVi, item.ThueVATDauVao || 0
        ]
      );
    }
    
    return { phieuNhapId, maPhieuNhap: MaPhieuNhap };
  });
}

/**
 * Duyệt phiếu nhập → Cộng tồn kho theo batch (FEFO)
 */
async function approveReceipt(phieuNhapId, approverId) {
  return withTransaction(async (conn) => {
    // Check status
    const [receipt] = await conn.query(
      'SELECT * FROM PhieuNhapHang WHERE PhieuNhapId = ? AND TrangThai = "DangCho"',
      [phieuNhapId]
    );
    
    if (receipt.length === 0) {
      throw new Error('Phiếu nhập không tồn tại hoặc đã được xử lý');
    }
    
    const pnh = receipt[0];
    
    // Get details
    const [details] = await conn.query(
      `SELECT ctpn.*, sp.TenSanPham 
       FROM ChiTietPhieuNhap ctpn
       JOIN SanPham sp ON ctpn.SanPhamId = sp.SanPhamId
       WHERE ctpn.PnhieuNhapId = ?`,
      [phieuNhapId]
    );
    
    let tongTienNhap = 0;
    let tongVAT = 0;
    
    for (const item of details) {
      const thanhTien = item.SoLuong * item.GiaNhapDonVi;
      const vatAmount = thanhTien * (item.ThueVATDauVao / 100);
      
      tongTienNhap += thanhTien;
      tongVAT += vatAmount;
      
      // Create or update batch inventory (FEFO)
      const [existingBatch] = await conn.query(
        `SELECT LoHangId, SoLuongHienTai FROM LoHangTonKho 
         WHERE SanPhamId = ? AND MaLo = ? AND TrangThai IN ('Available', 'SoldOut')`,
        [item.SanPhamId, item.MaLo]
      );
      
      if (existingBatch.length > 0) {
        // Update existing batch
        await conn.query(
          `UPDATE LoHangTonKho 
           SET SoLuongNhap = SoLuongNhap + ?, 
               SoLuongHienTai = SoLuongHienTai + ?,
               TrangThai = CASE WHEN SoLuongHienTai + ? > 0 THEN 'Available' ELSE 'SoldOut' END
           WHERE LoHangId = ?`,
          [item.SoLuong, item.SoLuong, item.SoLuong, existingBatch[0].LoHangId]
        );
      } else {
        // Create new batch
        await conn.query(
          `INSERT INTO LoHangTonKho 
           (SanPhamId, MaLo, SoLuongNhap, SoLuongHienTai, NgayNhap, NgayHetHan, TrangThai)
           VALUES (?, ?, ?, ?, CURDATE(), ?, 'Available')`,
          [
            item.SanPhamId, item.MaLo, item.SoLuong, item.SoLuong, 
            item.NgayHetHan || new Date(Date.now() + 365*24*60*60*1000) // Default 1 year
          ]
        );
      }
      
      // Update product's base cost (weighted average - optional)
      await conn.query(
        `UPDATE SanPham 
         SET GiaNhapGoc = ROUND((GiaNhapGoc * 0.7 + ? * 0.3), 0),
             NgayCapNhat = CURRENT_TIMESTAMP
         WHERE SanPhamId = ?`,
        [item.GiaNhapDonVi, item.SanPhamId]
      );
    }
    
    // Update receipt header
    await conn.query(
      `UPDATE PhieuNhapHang 
       SET TrangThai = 'DaNhan', TongTienNhap = ?, TongVATDauVao = ?, 
           NgayCapNhat = CURRENT_TIMESTAMP
       WHERE PhieuNhapId = ?`,
      [tongTienNhap, tongVAT, phieuNhapId]
    );
    
    return {
      message: 'Đã duyệt phiếu nhập và cập nhật tồn kho',
      tongTienNhap,
      tongVAT,
      soMatHang: details.length,
    };
  });
}

/**
 * Hủy phiếu nhập (chỉ khi còn trạng thái DangCho)
 */
async function cancelReceipt(phieuNhapId, reason) {
  const [result] = await pool.query(
    `UPDATE PhieuNhapHang 
     SET TrangThai = 'DaHuy', GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[Hủy] ', ?),
         NgayCapNhat = CURRENT_TIMESTAMP
     WHERE PhieuNhapId = ? AND TrangThai = 'DangCho'`,
    [reason, phieuNhapId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('Không thể hủy phiếu đã được duyệt');
  }
  
  return true;
}

/**
 * Lấy danh sách phiếu nhập với filter
 */
async function getAll(filters = {}, pagination = {}) {
  const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
  const { paginate } = require('../utils/pagination');
  
  const { where, params } = buildWhere(filters, { tableAlias: 'pnh' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['NgayLap', 'TongTienNhap']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM PhieuNhapHang pnh ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT 
       pnh.*, ncc.TenNhaCungCap, nv.HoTen as tenNguoiLap,
       (SELECT COUNT(*) FROM ChiTietPhieuNhap WHERE PhieuNhapId = pnh.PnhieuNhapId) as soMatHang
     FROM PhieuNhapHang pnh
     LEFT JOIN NhaCungCap ncc ON pnh.NhaCungCapId = ncc.NhaCungCapId
     LEFT JOIN NhanVien nv ON pnh.NhanVienId = nv.NhanVienId
     ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

module.exports = {
  createReceipt,
  approveReceipt,
  cancelReceipt,
  getAll,
};
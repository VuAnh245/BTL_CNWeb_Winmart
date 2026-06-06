'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode, generateEAN13 } = require('../utils/generateCode');
const { deleteUploadedFile } = require('../middlewares/upload.middleware');
const { MSG, format } = require('../constants/messages');
const appConfig = require('../config/app.config');

/**
 * Lấy danh sách sản phẩm với filter, sort, pagination
 * @param {Object} filters - { TenSanPham, DanhMucId, GiaBan, TrangThai, Barcode, is_active }
 * @param {Object} pagination - { page, limit, sortBy, direction }
 * @returns {Promise<{ items: Array, meta: Object }>}
 */
async function getAll(filters = {}, pagination = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'sp' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(
    pagination.sortBy, 
    ['TenSanPham', 'GiaBan', 'GiaNhapGoc', 'NgayTao', 'NgayCapNhat']
  );
  
  // Count query (chỉ đếm SP đang bán)
  const countParams = [...params];
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM SanPham sp ${where}`,
    countParams
  );
  
  // Data query với JOIN danh mục + NCC
  const [rows] = await pool.query(
    `SELECT 
       sp.*, 
       dm.TenDanhMuc, dm.MaDanhMuc,
       ncc.TenNhaCungCap, ncc.MaNhaCungCap,
       (SELECT SUM(SoLuongHienTai - SoLuongDuTru) FROM LoHangTonKho WHERE SanPhamId = sp.SanPhamId AND TrangThai = 'Available' AND SoLuongHienTai > SoLuongDuTru AND (NgayHetHan IS NULL OR NgayHetHan >= CURDATE())) as TongTonKho
     FROM SanPham sp
     LEFT JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId AND dm.is_active = 1
     LEFT JOIN NhaCungCap ncc ON sp.NhaCungCapId = ncc.NhaCungCapId AND ncc.is_active = 1
     ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

/**
 * Lấy chi tiết sản phẩm theo ID
 * @param {number} sanPhamId 
 * @returns {Promise<Object|null>}
 */
async function getById(sanPhamId) {
  const [rows] = await pool.query(
    `SELECT 
       sp.*, 
       dm.TenDanhMuc, dm.MaDanhMuc,
       ncc.TenNhaCungCap, ncc.SoDienThoai as NCCPhone
     FROM SanPham sp
     LEFT JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
     LEFT JOIN NhaCungCap ncc ON sp.NhaCungCapId = ncc.NhaCungCapId
     WHERE sp.SanPhamId = ?`,
    [sanPhamId]
  );
  
  const product = rows[0];
  if (!product) return null;
  
  // Lấy danh sách lô hàng
  const [batches] = await pool.query(
    `SELECT LoHangId as batchId, MaLo as maLo, SoLuongHienTai as soLuong, NgayHetHan as expiry
     FROM LoHangTonKho 
     WHERE SanPhamId = ? AND TrangThai = 'Available'`,
    [sanPhamId]
  );
  
  product.batches = batches || [];
  
  return product;
}

async function create(data, adminId) {
  const {
    TenSanPham, DanhMucId, NhaCungCapId, DonViTinh, Barcode,
    GiaBan, GiaNhapGoc, ThueVAT, HinhAnh, MucCanDat, TrangThai,
    CanNang, CanDongGoiDacBiet
  } = data;
  
  return withTransaction(async (conn) => {
    // Validate unique TenSanPham
    const [nameExists] = await conn.query(
      'SELECT 1 FROM SanPham WHERE TenSanPham = ? AND is_active = 1',
      [TenSanPham]
    );
    if (nameExists.length > 0) {
      throw new Error('Tên sản phẩm đã tồn tại trong hệ thống');
    }

    let finalBarcode = Barcode;
    
    // Nếu người dùng không nhập Barcode -> Tự động sinh mã EAN-13
    if (!finalBarcode) {
      finalBarcode = generateEAN13();
    }
    
    // Validate unique barcode
    if (finalBarcode) {
      const [exists] = await conn.query(
        'SELECT 1 FROM SanPham WHERE Barcode = ? AND is_active = 1',
        [finalBarcode]
      );
      if (exists.length > 0) {
        throw new Error('Mã vạch đã tồn tại trong hệ thống, vui lòng thử lại');
      }
    }
    
    // Generate code
    const MaSanPham = generateCode('SP', 6);
    
    const finalCanNang = (CanNang === undefined || CanNang === null || CanNang === '') ? 500 : parseInt(CanNang, 10);
    const finalCanDongGoi = (CanDongGoiDacBiet === 'on' || CanDongGoiDacBiet == 1) ? 1 : 0;

    // Insert product
    const [productResult] = await conn.query(
      `INSERT INTO SanPham 
       (MaSanPham, TenSanPham, DanhMucId, NhaCungCapId, DonViTinh, Barcode,
        GiaBan, GiaNhapGoc, ThueVAT, HinhAnh, MucCanDat, CanNang, CanDongGoiDacBiet, TrangThai, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        MaSanPham, TenSanPham, DanhMucId, NhaCungCapId || null, DonViTinh, finalBarcode,
        GiaBan, GiaNhapGoc, ThueVAT || appConfig.vat.default, HinhAnh || null, 
        MucCanDat || 10, finalCanNang, finalCanDongGoi, TrangThai || 'DangBan'
      ]
    );
    
    const sanPhamId = productResult.insertId;
    
    return { sanPhamId, maSanPham: MaSanPham };
  });
}

/**
 * Cập nhật sản phẩm (soft update)
 * @param {number} sanPhamId 
 * @param {Object} updates - Các field cần cập nhật
 * @param {number} adminId - Cho audit
 * @returns {Promise<boolean>}
 */
async function update(sanPhamId, updates, adminId) {
  const {
    TenSanPham, DanhMucId, NhaCungCapId, DonViTinh, Barcode,
    GiaBan, GiaNhapGoc, ThueVAT, HinhAnh, MucCanDat, TrangThai,
    oldImage, CanNang, CanDongGoiDacBiet
  } = updates;
  
  return withTransaction(async (conn) => {
    // Validate unique TenSanPham khi update
    if (TenSanPham) {
      const [nameExists] = await conn.query(
        'SELECT 1 FROM SanPham WHERE TenSanPham = ? AND SanPhamId != ? AND is_active = 1',
        [TenSanPham, sanPhamId]
      );
      if (nameExists.length > 0) {
        throw new Error('Tên sản phẩm đã tồn tại trong hệ thống');
      }
    }

    let finalBarcode = Barcode;
    if (Barcode !== undefined) {
      // Tự động tạo Barcode nếu bị bỏ trống khi update
      if (!Barcode || Barcode.trim() === '') {
        finalBarcode = generateCode('SP', 6);
      }
      
      // Validate unique barcode nếu đổi
      const [exists] = await conn.query(
        'SELECT 1 FROM SanPham WHERE Barcode = ? AND SanPhamId != ? AND is_active = 1',
        [finalBarcode, sanPhamId]
      );
      if (exists.length > 0) {
        throw new Error('Mã vạch đã tồn tại');
      }
    }
    
    // Build dynamic update
    const fields = [];
    const params = [];
    
    if (TenSanPham) { fields.push('TenSanPham = ?'); params.push(TenSanPham); }
    if (DanhMucId) { fields.push('DanhMucId = ?'); params.push(DanhMucId); }
    if (NhaCungCapId !== undefined) { fields.push('NhaCungCapId = ?'); params.push(NhaCungCapId); }
    if (DonViTinh) { fields.push('DonViTinh = ?'); params.push(DonViTinh); }
    if (Barcode !== undefined) { fields.push('Barcode = ?'); params.push(finalBarcode); }
    if (GiaBan !== undefined) { fields.push('GiaBan = ?'); params.push(GiaBan); }
    if (GiaNhapGoc !== undefined) { fields.push('GiaNhapGoc = ?'); params.push(GiaNhapGoc); }
    if (ThueVAT !== undefined) { fields.push('ThueVAT = ?'); params.push(ThueVAT); }
    if (HinhAnh !== undefined) { fields.push('HinhAnh = ?'); params.push(HinhAnh); }
    if (MucCanDat !== undefined) { fields.push('MucCanDat = ?'); params.push(MucCanDat); }
    if (CanNang !== undefined) {
      fields.push('CanNang = ?');
      params.push(CanNang === '' || CanNang === null ? 500 : parseInt(CanNang, 10));
    }
    if (CanDongGoiDacBiet !== undefined) {
      fields.push('CanDongGoiDacBiet = ?');
      params.push(CanDongGoiDacBiet === 'on' || CanDongGoiDacBiet == 1 ? 1 : 0);
    }
    if (TrangThai) { 
      fields.push('TrangThai = ?'); params.push(TrangThai);
      // Auto restore if DangBan, auto soft delete if NgungBan
      if (TrangThai === 'DangBan') {
        fields.push('is_active = 1');
      } else if (TrangThai === 'NgungBan') {
        fields.push('is_active = 0');
      }
    }
    
    if (fields.length === 0) return true;
    
    params.push(sanPhamId);
    
    // Update product
    const [result] = await conn.query(
      `UPDATE SanPham SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
       WHERE SanPhamId = ?`,
      params
    );
    
    // Delete old image file if changed
    if (oldImage && HinhAnh && HinhAnh !== oldImage) {
      await deleteUploadedFile(oldImage);
    }
    
    return result.affectedRows > 0;
  });
}

/**
 * Soft delete sản phẩm (đánh dấu is_active = 0)
 * @param {number} sanPhamId 
 * @param {number} adminId - Cho audit
 * @returns {Promise<boolean>}
 */
async function softDelete(sanPhamId, adminId) {
  return withTransaction(async (conn) => {
    // Kiểm tra có giao dịch liên quan không
    const [orderItems] = await conn.query(
      'SELECT 1 FROM ChiTietHoaDon WHERE SanPhamId = ? LIMIT 1',
      [sanPhamId]
    );
    const [importItems] = await conn.query(
      'SELECT 1 FROM ChiTietPhieuNhap WHERE SanPhamId = ? LIMIT 1',
      [sanPhamId]
    );
    
    if (orderItems.length > 0 || importItems.length > 0) {
      // Không cho xóa nếu đã có giao dịch → chỉ cho ngừng bán
      const [result] = await conn.query(
        'UPDATE SanPham SET TrangThai = "NgungBan", is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE SanPhamId = ?',
        [sanPhamId]
      );
      return result.affectedRows > 0;
    }
    
    // Nếu chưa có giao dịch → xóa mềm + xóa batch liên quan
    await conn.query('DELETE FROM LoHangTonKho WHERE SanPhamId = ?', [sanPhamId]);
    
    const [result] = await conn.query(
      'UPDATE SanPham SET is_active = 0, TrangThai = "NgungBan", NgayCapNhat = CURRENT_TIMESTAMP WHERE SanPhamId = ?',
      [sanPhamId]
    );
    
    return result.affectedRows > 0;
  });
}

/**
 * Tìm sản phẩm theo barcode (cho POS scan)
 * @param {string} barcode 
 * @returns {Promise<Object|null>}
 */
async function getByBarcode(barcode) {
    const [rows] = await pool.query(
      `SELECT sp.*, dm.TenDanhMuc,
         (SELECT SUM(SoLuongHienTai - SoLuongDuTru) FROM LoHangTonKho WHERE SanPhamId = sp.SanPhamId AND TrangThai = 'Available' AND SoLuongHienTai > SoLuongDuTru AND (NgayHetHan IS NULL OR NgayHetHan >= CURDATE())) as tonKho
       FROM SanPham sp
       LEFT JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
       WHERE sp.Barcode = ? AND sp.is_active = 1 AND sp.TrangThai = 'DangBan'
       LIMIT 1`,
      [barcode]
    );
  return rows[0] || null;
}

/**
 * Cập nhật tồn kho cảnh báo (dùng cho cron job)
 * @param {number} sanPhamId 
 * @returns {Promise<boolean>} True nếu cần cảnh báo
 */
async function checkLowStock(sanPhamId) {
  const [product] = await pool.query(
    `SELECT sp.MucCanDat, 
       (SELECT SUM(SoLuongHienTai) FROM LoHangTonKho WHERE SanPhamId = sp.SanPhamId AND TrangThai = 'Available') as tonKho
     FROM SanPham sp WHERE sp.SanPhamId = ?`,
    [sanPhamId]
  );
  
  if (!product[0]) return false;
  return (product[0].tonKho || 0) <= (product[0].MucCanDat || 10);
}

/**
 * Lấy danh sách sản phẩm sắp hết hạn (trong vòng 30 ngày)
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getExpiringProducts(limit = 4) {
  const [rows] = await pool.query(
    `SELECT sp.*, dm.TenDanhMuc, lh.NgayHetHan, lh.SoLuongHienTai, lh.MaLo 
     FROM LoHangTonKho lh
     JOIN SanPham sp ON lh.SanPhamId = sp.SanPhamId
     LEFT JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
     WHERE lh.TrangThai = 'Available' 
       AND lh.SoLuongHienTai > 0 
       AND lh.NgayHetHan IS NOT NULL
       AND lh.NgayHetHan >= CURDATE()
       AND sp.is_active = 1
       AND sp.TrangThai = 'DangBan'
     ORDER BY lh.NgayHetHan ASC
     LIMIT ?`,
    [limit]
  );
  
  // Xử lý TongTonKho (chỉ giả lập cho hiển thị giống product bình thường nếu view cần)
  // Tính tổng tồn kho thực tế của các sản phẩm này
  for (let product of rows) {
    const [tonKhoRows] = await pool.query(
      `SELECT SUM(SoLuongHienTai) as TongTonKho FROM LoHangTonKho WHERE SanPhamId = ? AND TrangThai = 'Available'`,
      [product.SanPhamId]
    );
    product.TongTonKho = tonKhoRows[0].TongTonKho || 0;
  }
  
  return rows;
}

module.exports = {
  getAll,
  getById,
  getByBarcode,
  create,
  update,
  softDelete,
  checkLowStock,
  getExpiringProducts
};
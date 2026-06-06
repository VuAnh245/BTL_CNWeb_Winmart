'use strict';

const { pool } = require('../config/db');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode } = require('../utils/generateCode');
const { MSG } = require('../constants/messages');

async function getAll(filters = {}, pagination = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'ncc' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['TenNhaCungCap', 'NgayTao']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM NhaCungCap ncc ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT ncc.*, 
       (SELECT COUNT(*) FROM SanPham sp WHERE sp.NhaCungCapId = ncc.NhaCungCapId AND sp.is_active = 1) as soSanPham,
       (SELECT COUNT(*) FROM PhieuNhapHang pnh WHERE pnh.NhaCungCapId = ncc.NhaCungCapId) as soPhieuNhap
     FROM NhaCungCap ncc ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

async function getById(nhaCungCapId) {
  const [rows] = await pool.query(
    `SELECT * FROM NhaCungCap 
     WHERE NhaCungCapId = ?`,
    [nhaCungCapId]
  );
  
  const supplier = rows[0];
  if (!supplier) return null;
  
  // Lấy danh sách sản phẩm bằng query riêng để tránh lỗi JSON_ARRAYAGG trên các phiên bản MariaDB cũ
  const [products] = await pool.query(
    `SELECT SanPhamId as id, TenSanPham as name, GiaBan as price 
     FROM SanPham 
     WHERE NhaCungCapId = ? AND is_active = 1`,
    [nhaCungCapId]
  );
  
  supplier.products = products || [];
  
  return supplier;
}

async function create(data, adminId) {
  const { TenNhaCungCap, SoDienThoai, Email, DiaChi, MaSoThue } = data;
  
  // Validate unique
  if (SoDienThoai) {
    const [exists] = await pool.query(
      'SELECT 1 FROM NhaCungCap WHERE SoDienThoai = ? AND is_active = 1',
      [SoDienThoai]
    );
    if (exists.length > 0) throw new Error('Số điện thoại đã tồn tại');
  }
  
  if (Email) {
    const [exists] = await pool.query(
      'SELECT 1 FROM NhaCungCap WHERE Email = ? AND is_active = 1',
      [Email]
    );
    if (exists.length > 0) throw new Error('Email đã tồn tại');
  }
  
  const MaNhaCungCap = generateCode('NCC', 4);
  
  const [result] = await pool.query(
    `INSERT INTO NhaCungCap 
     (MaNhaCungCap, TenNhaCungCap, SoDienThoai, Email, DiaChi, MaSoThue, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [MaNhaCungCap, TenNhaCungCap, SoDienThoai || null, Email || null, DiaChi || null, MaSoThue || null]
  );
  
  return { nhaCungCapId: result.insertId, maNhaCungCap: MaNhaCungCap };
}

async function update(nhaCungCapId, updates, adminId) {
  const { TenNhaCungCap, SoDienThoai, Email, DiaChi, MaSoThue, is_active } = updates;
  
  if (SoDienThoai) {
    const [exists] = await pool.query(
      'SELECT 1 FROM NhaCungCap WHERE SoDienThoai = ? AND NhaCungCapId != ?',
      [SoDienThoai, nhaCungCapId]
    );
    if (exists.length > 0) throw new Error('Số điện thoại đã tồn tại');
  }
  
  if (Email) {
    const [exists] = await pool.query(
      'SELECT 1 FROM NhaCungCap WHERE Email = ? AND NhaCungCapId != ?',
      [Email, nhaCungCapId]
    );
    if (exists.length > 0) throw new Error('Email đã tồn tại');
  }
  
  const fields = [];
  const params = [];
  
  if (TenNhaCungCap) { fields.push('TenNhaCungCap = ?'); params.push(TenNhaCungCap); }
  if (SoDienThoai !== undefined) { fields.push('SoDienThoai = ?'); params.push(SoDienThoai); }
  if (Email !== undefined) { fields.push('Email = ?'); params.push(Email); }
  if (DiaChi !== undefined) { fields.push('DiaChi = ?'); params.push(DiaChi); }
  if (MaSoThue !== undefined) { fields.push('MaSoThue = ?'); params.push(MaSoThue); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }
  
  if (fields.length === 0) return true;
  
  params.push(nhaCungCapId);
  
  const [result] = await pool.query(
    `UPDATE NhaCungCap SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
     WHERE NhaCungCapId = ?`,
    params
  );
  
  return result.affectedRows > 0;
}

async function softDelete(nhaCungCapId, adminId) {
  const [products] = await pool.query(
    'SELECT 1 FROM SanPham WHERE NhaCungCapId = ? AND is_active = 1 LIMIT 1',
    [nhaCungCapId]
  );
  
  if (products.length > 0) {
    // Chỉ soft-delete, không xóa cứng
    const [result] = await pool.query(
      'UPDATE NhaCungCap SET is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE NhaCungCapId = ?',
      [nhaCungCapId]
    );
    return result.affectedRows > 0;
  }
  
  const [result] = await pool.query(
    'UPDATE NhaCungCap SET is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE NhaCungCapId = ?',
    [nhaCungCapId]
  );
  
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete,
};
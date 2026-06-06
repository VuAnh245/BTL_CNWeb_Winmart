'use strict';

const { pool } = require('../config/db');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { generateCode } = require('../utils/generateCode');
const { MSG } = require('../constants/messages');

async function getAll(filters = {}, pagination = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'dm' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(pagination.sortBy, ['TenDanhMuc', 'NgayTao']);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM DanhMuc dm ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT dm.*, 
       (SELECT COUNT(*) FROM SanPham sp WHERE sp.DanhMucId = dm.DanhMucId AND sp.is_active = 1) as soSanPham
     FROM DanhMuc dm ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

async function getById(danhMucId) {
  const [rows] = await pool.query(
    `SELECT dm.* 
     FROM DanhMuc dm 
     WHERE dm.DanhMucId = ?`,
    [danhMucId]
  );
  
  const category = rows[0];
  if (!category) return null;
  
  // No need to fetch products as they are not used in the edit form
  category.products = [];
  
  return category;
}

async function create(data, adminId) {
  const { TenDanhMuc, MoTa } = data;
  
  // Check unique
  const [exists] = await pool.query(
    'SELECT 1 FROM DanhMuc WHERE TenDanhMuc = ? AND is_active = 1',
    [TenDanhMuc]
  );
  if (exists.length > 0) {
    throw new Error('Tên danh mục đã tồn tại');
  }
  
  const MaDanhMuc = generateCode('DM', 4);
  
  const [result] = await pool.query(
    `INSERT INTO DanhMuc (MaDanhMuc, TenDanhMuc, MoTa, is_active)
     VALUES (?, ?, ?, 1)`,
    [MaDanhMuc, TenDanhMuc, MoTa || null]
  );
  
  return { danhMucId: result.insertId, maDanhMuc: MaDanhMuc };
}

async function update(danhMucId, updates, adminId) {
  const { TenDanhMuc, MoTa, is_active } = updates;
  
  if (TenDanhMuc) {
    const [exists] = await pool.query(
      'SELECT 1 FROM DanhMuc WHERE TenDanhMuc = ? AND DanhMucId != ?',
      [TenDanhMuc, danhMucId]
    );
    if (exists.length > 0) {
      throw new Error('Tên danh mục đã tồn tại');
    }
  }
  
  const fields = [];
  const params = [];
  
  if (TenDanhMuc) { fields.push('TenDanhMuc = ?'); params.push(TenDanhMuc); }
  if (MoTa !== undefined) { fields.push('MoTa = ?'); params.push(MoTa); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }
  
  if (fields.length === 0) return true;
  
  params.push(danhMucId);
  
  const [result] = await pool.query(
    `UPDATE DanhMuc SET ${fields.join(', ')}, NgayCapNhat = CURRENT_TIMESTAMP
     WHERE DanhMucId = ?`,
    params
  );
  
  return result.affectedRows > 0;
}

async function softDelete(danhMucId, adminId) {
  // Kiểm tra có sản phẩm nào thuộc danh mục này không
  const [products] = await pool.query(
    'SELECT 1 FROM SanPham WHERE DanhMucId = ? AND is_active = 1 LIMIT 1',
    [danhMucId]
  );
  
  if (products.length > 0) {
    throw new Error('Không thể xóa danh mục đang có sản phẩm. Vui lòng chuyển sản phẩm sang danh mục khác trước.');
  }
  
  const [result] = await pool.query(
    'UPDATE DanhMuc SET is_active = 0, NgayCapNhat = CURRENT_TIMESTAMP WHERE DanhMucId = ?',
    [danhMucId]
  );
  
  return result.affectedRows > 0;
}

async function getTree() {
  // Future: Hỗ trợ danh mục đa cấp
  const [rows] = await pool.query(
    'SELECT DanhMucId, MaDanhMuc, TenDanhMuc, MoTa FROM DanhMuc WHERE is_active = 1 ORDER BY TenDanhMuc'
  );
  return rows;
}

module.exports = {
  getAll,
  getById,
  getTree,
  create,
  update,
  softDelete,
};
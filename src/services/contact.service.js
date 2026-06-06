'use strict';

const { pool } = require('../config/db');
const { paginate } = require('../utils/pagination');
const { MSG } = require('../constants/messages');

/**
 * Tạo yêu cầu liên hệ mới
 */
async function createContact(data) {
  const { HoTen, Email, SoDienThoai, TieuDe, NoiDung, LoaiYeuCau } = data;
  
  const [result] = await pool.query(
    `INSERT INTO Contact 
     (HoTen, Email, SoDienThoai, TieuDe, NoiDung, LoaiYeuCau, TrangThai)
     VALUES (?, ?, ?, ?, ?, ?, 'Moi')`,
    [HoTen, Email, SoDienThoai, TieuDe, NoiDung, LoaiYeuCau || 'Khac']
  );
  
  return { contactId: result.insertId, message: 'Đã gửi yêu cầu. Chúng tôi sẽ phản hồi trong 24h.' };
}

/**
 * Admin: Lấy danh sách yêu cầu liên hệ
 */
async function getAll(filters = {}, pagination = {}) {
  const { buildWhere } = require('../utils/queryBuilder');
  
  const { where, params } = buildWhere(filters, { tableAlias: 'c' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM Contact c ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT c.*, kh.HoTen as tenKhachHang
     FROM Contact c
     LEFT JOIN KhachHang kh ON c.Email = kh.Email OR c.SoDienThoai = kh.SoDienThoai
     ${where} ORDER BY c.NgayTao DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

/**
 * Admin: Cập nhật trạng thái & phản hồi
 */
async function updateContact(contactId, updates, adminId) {
  const { TrangThai, NoiDungPhanHoi } = updates;
  
  const fields = [];
  const params = [];
  
  if (TrangThai) { fields.push('TrangThai = ?'); params.push(TrangThai); }
  if (NoiDungPhanHoi) { fields.push('NoiDungPhanHoi = ?'); params.push(NoiDungPhanHoi); }
  if (fields.length > 0) {
    fields.push('NguoiPhanHoi = ?', 'NgayPhanHoi = CURRENT_TIMESTAMP');
    params.push(adminId);
  }
  
  if (fields.length === 0) return true;
  
  params.push(contactId);
  
  const [result] = await pool.query(
    `UPDATE Contact SET ${fields.join(', ')} WHERE ContactId = ?`,
    params
  );
  
  return result.affectedRows > 0;
}

/**
 * Admin: Xóa yêu cầu (soft delete)
 */
async function softDelete(contactId) {
  const [result] = await pool.query(
    'UPDATE Contact SET is_active = 0 WHERE ContactId = ?',
    [contactId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  createContact,
  getAll,
  updateContact,
  softDelete,
};
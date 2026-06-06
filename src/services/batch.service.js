'use strict';

const { pool } = require('../config/db');
const appConfig = require('../config/app.config');
const { isExpired, daysUntilExpiry } = require('../utils/expiryChecker');
const { MSG, format } = require('../constants/messages');

/**
 * Lấy danh sách batch khả dụng theo FEFO (First Expire First Out)
 * @param {number} sanPhamId 
 * @param {number} quantityNeeded - Số lượng cần lấy
 * @param {Connection} conn - Optional: dùng trong transaction
 * @returns {Promise<Array>} List of { batchId, maLo, quantity, expiry_date }
 */
async function getFEFOBatches(sanPhamId, quantityNeeded, conn = null) {
  const executor = conn || pool;
  
  const [batches] = await executor.query(
    `SELECT LoHangId, MaLo, SoLuongHienTai, SoLuongDuTru, NgayHetHan
     FROM LoHangTonKho
     WHERE SanPhamId = ? 
       AND TrangThai = 'Available'
       AND SoLuongHienTai > SoLuongDuTru
       AND (NgayHetHan IS NULL OR NgayHetHan >= CURDATE())
     ORDER BY NgayHetHan ASC, LoHangId ASC`,
    [sanPhamId]
  );
  
  const result = [];
  let remaining = quantityNeeded;
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    
    const available = batch.SoLuongHienTai - batch.SoLuongDuTru;
    if (available <= 0) continue;
    
    const take = Math.min(available, remaining);
    result.push({
      batchId: batch.LoHangId,
      maLo: batch.MaLo,
      takeQty: take,
      expiryDate: batch.NgayHetHan,
      daysUntilExpiry: daysUntilExpiry(batch.NgayHetHan),
    });
    remaining -= take;
  }
  
  if (remaining > 0) {
    const error = new Error(format(MSG.PRODUCT.OUT_OF_STOCK, { 
      name: `SP#${sanPhamId}`,
      qty: remaining 
    }));
    error.code = 'INSUFFICIENT_STOCK';
    throw error;
  }
  
  return result;
}

/**
 * Reserve tồn kho tạm thời (giữ chỗ chờ thanh toán)
 * @param {Array} batchAllocations - [{ batchId, takeQty }]
 * @param {Connection} conn - Bắt buộc dùng trong transaction
 */
async function reserveStock(batchAllocations, conn) {
  for (const { batchId, takeQty } of batchAllocations) {
    await conn.query(
      `UPDATE LoHangTonKho 
       SET SoLuongDuTru = SoLuongDuTru + ?, TrangThai = 'Reserved'
       WHERE LoHangId = ? AND TrangThai = 'Available'`,
      [takeQty, batchId]
    );
  }
}

/**
 * Release reserved stock (khi hủy đơn hoặc timeout)
 * @param {Array} batchAllocations 
 * @param {Connection} conn
 */
async function releaseStock(batchAllocations, conn) {
  for (const { batchId, takeQty } of batchAllocations) {
    await conn.query(
      `UPDATE LoHangTonKho 
       SET SoLuongDuTru = GREATEST(0, SoLuongDuTru - ?),
           TrangThai = CASE 
             WHEN SoLuongHienTai - SoLuongDuTru > 0 THEN 'Available'
             ELSE 'SoldOut'
           END
       WHERE LoHangId = ?`,
      [takeQty, batchId]
    );
  }
}

/**
 * Deduct stock thực tế (sau khi thanh toán thành công)
 * @param {Array} batchAllocations 
 * @param {Connection} conn
 */
async function deductStock(batchAllocations, conn) {
  for (const { batchId, takeQty } of batchAllocations) {
    await conn.query(
      `UPDATE LoHangTonKho 
       SET SoLuongHienTai = SoLuongHienTai - ?,
           SoLuongDuTru = GREATEST(0, SoLuongDuTru - ?),
           TrangThai = CASE 
             WHEN SoLuongHienTai - ? <= 0 THEN 'SoldOut'
             ELSE 'Available'
           END
       WHERE LoHangId = ?`,
      [takeQty, takeQty, takeQty, batchId]
    );
  }
}

/**
 * Kiểm tra batch sắp hết hạn (< expiryWarnDays)
 * @param {number} storeId 
 * @returns {Promise<Array>} List of warning items
 */
async function getExpiryWarnings(storeId = 1) {
  const warnDays = appConfig.inventory.expiryWarnDays;
  
  const [warnings] = await pool.query(
    `SELECT 
       lhtk.LoHangId, lhtk.MaLo, lhtk.NgayHetHan,
       sp.SanPhamId, sp.TenSanPham, sp.MaSanPham,
       DATEDIFF(lhtk.NgayHetHan, CURDATE()) as daysLeft
     FROM LoHangTonKho lhtk
     JOIN SanPham sp ON lhtk.SanPhamId = sp.SanPhamId
     WHERE lhtk.NgayHetHan BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND lhtk.TrangThai = 'Available'
       AND sp.is_active = 1
     ORDER BY lhtk.NgayHetHan ASC`,
    [warnDays]
  );
  
  return warnings.map(w => ({
    ...w,
    message: format(MSG.INVENTORY.BATCH_EXPIRY_WARN, {
      batch: w.MaLo,
      product: w.TenSanPham,
      days: w.daysLeft,
    }),
  }));
}

/**
 * Cron job: Mark expired batches as 'Expired'
 * Chạy daily lúc 00:00
 */
async function markExpiredBatches() {
  const [result] = await pool.query(
    `UPDATE LoHangTonKho 
     SET TrangThai = 'Expired'
     WHERE TrangThai IN ('Available', 'Reserved')
       AND NgayHetHan < CURDATE()`
  );
  
  if (result.affectedRows > 0) {
    console.log(`[BatchService] Marked ${result.affectedRows} batches as Expired`);
  }
  return result.affectedRows;
}

module.exports = {
  getFEFOBatches,
  reserveStock,
  releaseStock,
  deductStock,
  getExpiryWarnings,
  markExpiredBatches,
};
'use strict';

const appConfig = require('../config/app.config');

/**
 * Lọc danh sách batch sắp hết hạn trong N ngày tới
 * @param {Array} batches - mảng object có trường expiry_date (Date/string)
 * @param {number} [days] - Số ngày cảnh báo trước (default: appConfig.inventory.expiryWarnDays)
 * @returns {Array} batches sắp hết hạn
 */
function filterExpiringBatches(batches, days = appConfig.inventory.expiryWarnDays) {
  if (!Array.isArray(batches)) return [];
  
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset time để so sánh ngày chính xác
  
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);
  
  return batches.filter(b => {
    if (!b.expiry_date) return false;
    const exp = new Date(b.expiry_date);
    exp.setHours(0, 0, 0, 0);
    return exp >= now && exp <= cutoff;
  });
}

/**
 * Kiểm tra batch đã hết hạn chưa
 * @param {Date|string} expiryDate
 * @returns {boolean}
 */
function isExpired(expiryDate) {
  if (!expiryDate) return true;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return exp < now;
}

/**
 * Tính số ngày còn lại đến hạn
 * @param {Date|string} expiryDate
 * @returns {number} Số ngày (âm nếu đã hết hạn)
 */
function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return -1;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = { filterExpiringBatches, isExpired, daysUntilExpiry };
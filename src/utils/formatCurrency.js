'use strict';

// Tạo formatter một lần, tái sử dụng (performance)
const formatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0, // Không hiển thị .000
  maximumFractionDigits: 0,
});

/**
 * Format số thành tiền Việt: 150000 → "150.000 ₫"
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '0 ₫';
  return formatter.format(num);
}

/**
 * Format số ngắn gọn cho dashboard: 1500000 → "1,5 tr"
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrencyShort(amount) {
  const n = Number(amount) || 0;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.0', '')} tỷ`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1).replace('.0', '')} tr`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/**
 * Parse string tiền Việt về số: "150.000 ₫" → 150000
 * @param {string} formatted
 * @returns {number}
 */
function parseCurrency(formatted) {
  if (!formatted) return 0;
  // Remove non-digit except minus
  const cleaned = String(formatted).replace(/[^\d\-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

module.exports = { formatCurrency, formatCurrencyShort, parseCurrency };
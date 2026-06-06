'use strict';

/**
 * Làm sạch input barcode từ scanner (EAN-13/EAN-8, strip Enter/whitespace)
 * Scanner thường gửi kèm `\r` hoặc `\n` cuối chuỗi
 * @param {string} raw - Input thô từ input field/keypress
 * @returns {string} Barcode đã clean
 */
function parseBarcode(raw) {
  return String(raw || '').trim().replace(/[\r\n\t]+/g, '');
}

/**
 * Kiểm tra định dạng EAN-13 (13 chữ số)
 * @param {string} code
 * @returns {boolean}
 */
function isEAN13(code) {
  return /^\d{13}$/.test(code);
}

/**
 * Kiểm tra định dạng EAN-8 (8 chữ số - sản phẩm nhỏ)
 * @param {string} code
 * @returns {boolean}
 */
function isEAN8(code) {
  return /^\d{8}$/.test(code);
}

/**
 * Validate checksum EAN-13 theo thuật toán chuẩn
 * @param {string} code - 13 chữ số
 * @returns {boolean}
 */
function validateEAN13Checksum(code) {
  if (!isEAN13(code)) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === parseInt(code[12], 10);
}

module.exports = { parseBarcode, isEAN13, isEAN8, validateEAN13Checksum };
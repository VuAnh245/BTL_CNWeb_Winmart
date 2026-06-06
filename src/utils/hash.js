'use strict';

const bcrypt = require('bcryptjs');

// Salt rounds: 12 là cân bằng giữa bảo mật và performance
// Tham khảo: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

/**
 * Hash mật khẩu với bcrypt
 * @param {string} plain - Mật khẩu gốc
 * @returns {Promise<string>} Hash string
 */
async function hashPassword(plain) {
  if (!plain || typeof plain !== 'string') {
    throw new Error('Mật khẩu không hợp lệ');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * So sánh mật khẩu nhập với hash đã lưu
 * @param {string} plain - Mật khẩu nhập
 * @param {string} hashed - Hash từ database
 * @returns {Promise<boolean>}
 */
async function comparePassword(plain, hashed) {
  if (!plain || !hashed) return false;
  return bcrypt.compare(plain, hashed);
}

/**
 * Kiểm tra format hash bcrypt hợp lệ
 * @param {string} hash
 * @returns {boolean}
 */
function isValidHash(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$\d+\$/.test(hash);
}

module.exports = { hashPassword, comparePassword, isValidHash };
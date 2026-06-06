'use strict';

const { pool } = require('../config/db');
const appConfig = require('../config/app.config');

/**
 * Thực thi một tác vụ trong transaction MySQL.
 * Tự động COMMIT nếu thành công, ROLLBACK nếu có lỗi.
 * Đảm bảo ACID cho các luồng quan trọng: Checkout, Nhập kho, Điều chỉnh điểm.
 * 
 * @param {Function} fn - async (conn) => result
 * @param {Object} options - { timeout: 30000 } (ms)
 * @returns {Promise<any>}
 * 
 * @example
 * const result = await withTransaction(async (conn) => {
 *   await conn.execute('INSERT INTO orders ...', [...]);
 *   await conn.execute('UPDATE batch_inventory ...', [...]);
 *   return { orderId: 1 };
 * });
 */
async function withTransaction(fn, options = {}) {
  const timeout = options.timeout || 30000; // Default 30s
  const conn = await pool.getConnection();
  
  // Set timeout cho transaction (tránh lock lâu)
  await conn.query(`SET SESSION innodb_lock_wait_timeout = ${Math.floor(timeout / 1000)}`);
  
  await conn.beginTransaction();
  
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    
    // Log chi tiết lỗi transaction ở dev mode
    if (appConfig.log.enableStack) {
      console.error('[TRANSACTION ROLLBACK]', err.message, {
        code: err.code,
        errno: err.errno,
        sqlState: err.sqlState,
      });
    }
    
    // Wrap lỗi để controller dễ xử lý
    const wrappedError = new Error('Giao dịch thất bại: ' + err.message);
    wrappedError.originalError = err;
    wrappedError.code = err.code || 'TRANSACTION_FAILED';
    throw wrappedError;
  } finally {
    conn.release();
  }
}

/**
 * Helper: Thực thi query với retry logic (cho deadlock)
 * MySQL có thể trả lỗi ER_LOCK_DEADLOCK (1213) → retry 1-2 lần
 * 
 * @param {Connection} conn
 * @param {string} sql
 * @param {Array} params
 * @param {number} maxRetries
 * @returns {Promise<[results, fields]>}
 */
async function executeWithRetry(conn, sql, params = [], maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await conn.execute(sql, params);
    } catch (err) {
      lastError = err;
      // Chỉ retry deadlock hoặc lock wait timeout
      if (err.code === 'ER_LOCK_DEADLOCK' || err.errno === 1205) {
        if (attempt <= maxRetries) {
          // Exponential backoff: 100ms, 200ms
          await new Promise(resolve => setTimeout(resolve, attempt * 100));
          continue;
        }
      }
      // Lỗi khác → ném ngay
      throw err;
    }
  }
  
  throw lastError;
}

module.exports = { withTransaction, executeWithRetry };
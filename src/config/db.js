'use strict';

// src/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Cấu hình Connection Pool cho MySQL
 * Đáp ứng: NFP-Performance (Pool 10), NFP-Consistency (ACID ready), Charset utf8mb4
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'winmart_pos',
  
  // Pool configuration
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
  
  // Character & Timezone
  charset: 'utf8mb4',
  timezone: process.env.TIMEZONE || '+07:00',
  
  // Keep-alive & Stability
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Debug (tắt trong production)
  debug: process.env.NODE_ENV === 'development' ? false : false
});

/**
 * Kiểm tra kết nối database khi khởi động server
 * Trả về Promise để server.js await trước khi listen
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ [DB] Kết nối MySQL thành công: ${process.env.DB_NAME}`);
    console.log(`📊 [DB] Pool limit: ${process.env.DB_CONNECTION_LIMIT || 10} | Charset: utf8mb4`);
    connection.release();
    return true;
  } catch (err) {
    console.error('❌ [DB] Lỗi kết nối MySQL:', err.message);
    console.error('💡 Kiểm tra lại .env (DB_USER, DB_PASSWORD, DB_NAME) hoặc XAMPP MySQL có đang chạy không?');
    return false;
  }
}

/**
 * Đóng pool khi server shutdown (graceful exit)
 */
async function closePool() {
  await pool.end();
  console.log('🔒 [DB] Connection pool đã đóng.');
}

module.exports = { pool, testConnection, closePool };

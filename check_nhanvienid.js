const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'winmart'
  });

  const [rows] = await pool.query("SHOW COLUMNS FROM HoaDonBanHang LIKE 'NhanVienId'");
  console.log(rows);
  
  process.exit(0);
}
run();

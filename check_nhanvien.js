const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'winmart'
  });

  const [rows] = await pool.query('SHOW TABLES;');
  console.log(rows);
  
  const [nv] = await pool.query('SELECT * FROM NhanVien');
  console.log('NhanVien:', nv);
  
  process.exit(0);
}
run();

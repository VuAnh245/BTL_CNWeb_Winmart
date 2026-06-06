const { pool } = require('./src/config/db');

async function test() {
  const [rows] = await pool.query("DESCRIBE SanPham");
  console.log(rows);
  process.exit(0);
}
test();

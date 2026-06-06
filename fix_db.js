const { pool } = require('./src/config/db');

async function fixData() {
  // Update promo usage
  await pool.query("UPDATE MaGiamGia SET SoLanDaSuDung = 1 WHERE MaGiamGiaId = 2 AND SoLanDaSuDung = 2");
  
  const [promo] = await pool.query("SELECT * FROM MaGiamGia WHERE MaGiamGiaId = 2");
  console.log("Promo Fixed:", promo[0]);
  
  process.exit(0);
}
fixData();

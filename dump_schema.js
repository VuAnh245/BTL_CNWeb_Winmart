const db = require('./src/config/db'); async function dump() { const [r1] = await db.pool.query('SHOW CREATE TABLE CuaHang'); console.log(r1[0]['Create Table']); process.exit(); } dump();

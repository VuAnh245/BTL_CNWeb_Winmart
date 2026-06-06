const db = require('./src/config/db');

(async () => {
    try {
        console.log('Querying SanPham table...');
        const [rows] = await db.pool.query("SELECT * FROM SanPham WHERE TenSanPham LIKE '%Vinamilk%'");
        console.log('Products matching Vinamilk:', rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();

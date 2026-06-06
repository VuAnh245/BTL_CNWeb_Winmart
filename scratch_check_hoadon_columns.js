const db = require('./src/config/db');

(async () => {
    try {
        console.log('Describing HoaDonBanHang...');
        const [rows] = await db.pool.query('DESCRIBE HoaDonBanHang');
        console.log(rows.map(r => ({ Field: r.Field, Type: r.Type })));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();

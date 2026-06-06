const db = require('./src/config/db');

(async () => {
    try {
        console.log('Querying CuaHang...');
        const [rows] = await db.pool.query('SELECT * FROM CuaHang');
        console.log('CuaHang rows:', rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
})();

const db = require('./src/config/db');

async function run() {
    try {
        console.log("Restoring order 31 to Delivering status...");
        await db.pool.query(`UPDATE HoaDonBanHang SET TrangThai = 'Delivering' WHERE HoaDonId = 31`);
        console.log("Restored successfully!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();

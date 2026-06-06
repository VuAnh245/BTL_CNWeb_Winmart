const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'd:/GeneralDirectory/CNWeb/Winmart_Web/.env' });
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'winmart_pos'
        });
        await pool.query("ALTER TABLE HoaDonBanHang MODIFY COLUMN TrangThai ENUM('Pending', 'Paid', 'Delivering', 'Completed', 'Cancelled', 'Cancelled_Return', 'Refunded') DEFAULT 'Pending'");
        console.log("Database ENUM altered successfully.");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();

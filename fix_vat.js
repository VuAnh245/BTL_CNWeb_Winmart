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
        
        const [orders] = await pool.query(`SELECT HoaDonId, TongTienTruocKM, PhiShip, TongTienSauKM FROM HoaDonBanHang WHERE MaLoaiHinh IN ('ONLINE', 'WEB')`);
        console.log('Found ' + orders.length + ' online orders');
        
        let fixedCount = 0;
        for (const order of orders) {
            const [items] = await pool.query('SELECT SanPhamId, SoLuong, DonGiaGoc, ThueVATApDung, ThanhTienCuoi FROM ChiTietHoaDon WHERE HoaDonId = ?', [order.HoaDonId]);
            let totalVat = 0;
            let totalAmount = 0;
            
            for (const item of items) {
                const itemVat = (item.DonGiaGoc * item.SoLuong) * ((item.ThueVATApDung || 0) / 100);
                totalVat += itemVat;
                totalAmount += (item.DonGiaGoc * item.SoLuong);
                
                const lineFinal = (item.DonGiaGoc * item.SoLuong) + itemVat;
                await pool.query('UPDATE ChiTietHoaDon SET ThanhTienCuoi = ? WHERE HoaDonId = ? AND SanPhamId = ?', [lineFinal, order.HoaDonId, item.SanPhamId]);
            }
            
            const expectedTotal = totalAmount + totalVat + Number(order.PhiShip);
            
            // Fix TongTienSauKM so that Discount is 0 (since they didn't use promo in these broken orders)
            // Or if they did use a promo, well, actually we can just update it based on the diff.
            // Wait, what if they DID use a promo code? The old system didn't add VAT, so the customer paid: 
            // Paid = TongTienTruocKM + PhiShip - PromoDiscount
            // Now, we want to add VAT to the grand total, so the NEW TongTienSauKM = Old TongTienSauKM + totalVat
            const updatedTotal = Number(order.TongTienSauKM) + totalVat;
            
            // Only update if it hasn't been updated yet (check if total is mathematically without VAT)
            // If the current TongTienSauKM is missing the VAT, fix it
            if (Number(order.TongTienSauKM) < expectedTotal) {
                await pool.query('UPDATE HoaDonBanHang SET TongTienSauKM = ? WHERE HoaDonId = ?', [updatedTotal, order.HoaDonId]);
                fixedCount++;
            }
        }
        
        console.log('Fixed ' + fixedCount + ' old online orders to include VAT in their totals.');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();

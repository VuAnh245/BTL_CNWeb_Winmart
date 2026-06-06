const { pool } = require('../../src/config/db');

async function fix() {
    try {
        console.log("Fixing image path...");
        await pool.query(`UPDATE SanPham SET HinhAnh = '/images/products/Kẹo XyLiTol.jpg' WHERE MaSanPham = 'SP005'`);
        
        console.log("Adding stock to products...");
        const [products] = await pool.query(`SELECT SanPhamId FROM SanPham`);
        for (const p of products) {
            // Check if stock already exists
            const [stock] = await pool.query(`SELECT LoHangId FROM LoHangTonKho WHERE SanPhamId = ?`, [p.SanPhamId]);
            if (stock.length === 0) {
                await pool.query(`
                    INSERT INTO LoHangTonKho (SanPhamId, MaLo, SoLuongNhap, SoLuongHienTai, NgayNhap, NgayHetHan) 
                    VALUES (?, ?, 100, 100, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))
                `, [p.SanPhamId, 'LO00' + p.SanPhamId]);
            }
        }
        console.log("Fixed image and added stock successfully!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fix();

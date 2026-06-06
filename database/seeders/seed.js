const { pool } = require('../../src/config/db');

async function seed() {
    try {
        console.log("Removing triggers...");
        await pool.query(`DROP TRIGGER IF EXISTS TR_PreventHardDelete_SanPham`);
        await pool.query(`DROP TRIGGER IF EXISTS TR_PreventHardDelete_DanhMuc`);

        console.log("Deleting old data...");
        await pool.query(`SET FOREIGN_KEY_CHECKS = 0`);
        await pool.query(`DELETE FROM ChiTietHoaDon`);
        await pool.query(`DELETE FROM ChiTietPhieuNhap`);
        await pool.query(`DELETE FROM LoHangTonKho`);
        await pool.query(`DELETE FROM SanPham`);
        await pool.query(`DELETE FROM DanhMuc`);
        await pool.query(`SET FOREIGN_KEY_CHECKS = 1`);

        console.log("Resetting AUTO_INCREMENT...");
        await pool.query(`ALTER TABLE DanhMuc AUTO_INCREMENT = 1`);
        await pool.query(`ALTER TABLE SanPham AUTO_INCREMENT = 1`);

        console.log("Inserting categories...");
        await pool.query(`
            INSERT INTO DanhMuc (DanhMucId, MaDanhMuc, TenDanhMuc, MoTa, is_active) VALUES
            (1, 'DM001', 'Bánh Kẹo', 'Các loại bánh ngọt, kẹo dẻo, socola', 1),
            (2, 'DM002', 'Đồ Uống', 'Nước giải khát, nước suối, sữa', 1),
            (3, 'DM003', 'Thực Phẩm Khô & Gia Vị', 'Mì gói, nước mắm, xì dầu', 1),
            (4, 'DM004', 'Thực Phẩm Tươi Sống', 'Trái cây, cá viên, thực phẩm đông lạnh', 1),
            (5, 'DM005', 'Hóa Phẩm & Gia Đình', 'Bột giặt, sữa tắm, đồ gia dụng', 1)
        `);

        console.log("Inserting products...");
        await pool.query(`
            INSERT INTO SanPham (MaSanPham, TenSanPham, DanhMucId, GiaNhapGoc, GiaBan, HinhAnh, is_active) VALUES
            ('SP001', 'Bánh Choco Japan', 1, 35000, 42000, '/images/products/Bánh Choco Japan.jpg', 1),
            ('SP002', 'Bánh quy bơ Danisa', 1, 120000, 145000, '/images/products/Bánh Danisa.jpg', 1),
            ('SP003', 'Bánh Tipo trứng nướng', 1, 40000, 48000, '/images/products/Bánh Tipo.jpg', 1),
            ('SP004', 'Bánh Chocopie', 1, 45000, 55000, '/images/products/banh-chocopie.jpg', 1),
            ('SP005', 'Kẹo cao su Xylitol', 1, 18000, 22000, '/images/products/Keo XyLiTol.jpg', 1),
            ('SP006', 'Kẹo dẻo Haribo', 1, 25000, 32000, '/images/products/keo-deo-haribo.jpg', 1),
            ('SP007', 'Nước suối Aquafina 500ml', 2, 4000, 5000, '/images/products/nuoc-suoi-aquafina-500ml.jpg', 1),
            ('SP008', 'Pepsi lon 330ml', 2, 8000, 10000, '/images/products/pepsi-lon-330ml.jpg', 1),
            ('SP009', 'Sữa tươi Vinamilk 1L', 2, 28000, 34000, '/images/products/sua-tuoi-vinamilk-1l.jpg', 1),
            ('SP010', 'Mì Hảo Hảo tôm chua cay', 3, 3000, 4000, '/images/products/mi-hao-hao.jpg', 1),
            ('SP011', 'Nước mắm Nam Ngư', 3, 32000, 39000, '/images/products/Nước mắm nam ngư.jpg', 1),
            ('SP012', 'Nước tương Hương Việt', 3, 15000, 18000, '/images/products/Nước tương hương việt.jpg', 1),
            ('SP013', 'Cá viên chiên', 4, 45000, 55000, '/images/products/Cá Viên Chiên.jpg', 1),
            ('SP014', 'Lê Hàn Quốc (Kg)', 4, 85000, 110000, '/images/products/lehanquoc.jpg', 1),
            ('SP015', 'Táo Mỹ (Kg)', 4, 75000, 95000, '/images/products/Táo Mỹ.jpg', 1),
            ('SP016', 'Bột giặt OMO 3kg', 5, 115000, 135000, '/images/products/bot-giat-omo-3kg.jpg', 1),
            ('SP017', 'Chổi quét nhà', 5, 25000, 35000, '/images/products/choi-quet-nha.jpg', 1),
            ('SP018', 'Nồi inox 20cm', 5, 180000, 220000, '/images/products/noi-inox-20cm.jpg', 1),
            ('SP019', 'Sữa tắm Dove 500ml', 5, 95000, 115000, '/images/products/sua-tam-dove-500ml.jpg', 1)
        `);

        console.log("Recreating triggers...");
        await pool.query(`
            CREATE TRIGGER TR_PreventHardDelete_SanPham
            BEFORE DELETE ON SanPham
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Khong duoc phep xoa cung. Vui long cap nhat is_active = 0 hoac TrangThai = "NgungBan" trong ung dung.';
            END
        `);
        await pool.query(`
            CREATE TRIGGER TR_PreventHardDelete_DanhMuc
            BEFORE DELETE ON DanhMuc
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Khong duoc phep xoa cung danh muc. Vui long dat is_active = 0.';
            END
        `);

        console.log("Seeding completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Seeding failed:", e);
        process.exit(1);
    }
}

seed();

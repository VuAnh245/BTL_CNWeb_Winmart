const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Đang kết nối database để migration...');
        const connection = await db.pool.getConnection();

        // 1. Bảng SanPham
        try {
            await connection.query('ALTER TABLE SanPham ADD COLUMN CanNang INT DEFAULT 500 AFTER MucCanDat;');
            console.log('✅ Đã thêm cột CanNang vào bảng SanPham');
        } catch (e) { console.log('⚠️ Cột CanNang đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE SanPham ADD COLUMN CanDongGoiDacBiet TINYINT(1) DEFAULT 0 AFTER CanNang;');
            console.log('✅ Đã thêm cột CanDongGoiDacBiet vào bảng SanPham');
        } catch (e) { console.log('⚠️ Cột CanDongGoiDacBiet đã tồn tại hoặc lỗi:', e.message); }

        // 2. Bảng HoaDonBanHang
        try {
            await connection.query('ALTER TABLE HoaDonBanHang ADD COLUMN ToProvinceId INT DEFAULT NULL AFTER DiaChiNhan;');
            console.log('✅ Đã thêm cột ToProvinceId vào bảng HoaDonBanHang');
        } catch (e) { console.log('⚠️ Cột ToProvinceId đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE HoaDonBanHang ADD COLUMN ToDistrictId INT DEFAULT NULL AFTER ToProvinceId;');
            console.log('✅ Đã thêm cột ToDistrictId vào bảng HoaDonBanHang');
        } catch (e) { console.log('⚠️ Cột ToDistrictId đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE HoaDonBanHang ADD COLUMN ToWardCode VARCHAR(20) DEFAULT NULL AFTER ToDistrictId;');
            console.log('✅ Đã thêm cột ToWardCode vào bảng HoaDonBanHang');
        } catch (e) { console.log('⚠️ Cột ToWardCode đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE HoaDonBanHang ADD COLUMN GHNOrderCode VARCHAR(50) DEFAULT NULL AFTER ToWardCode;');
            console.log('✅ Đã thêm cột GHNOrderCode vào bảng HoaDonBanHang');
        } catch (e) { console.log('⚠️ Cột GHNOrderCode đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query("ALTER TABLE HoaDonBanHang MODIFY COLUMN TrangThai ENUM('Pending', 'Paid', 'Delivering', 'Completed', 'Cancelled', 'Cancelled_Return', 'Refunded') DEFAULT 'Pending'");
            console.log('✅ Đã cập nhật ENUM TrangThai cho bảng HoaDonBanHang');
        } catch (e) { console.log('⚠️ Lỗi cập nhật ENUM TrangThai:', e.message); }

        // 3. Bảng CuaHang
        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN FreeShipThreshold INT DEFAULT 300000;');
            console.log('✅ Đã thêm cột FreeShipThreshold vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột FreeShipThreshold đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN FreshTier1Fee INT DEFAULT 15000;');
            console.log('✅ Đã thêm cột FreshTier1Fee vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột FreshTier1Fee đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN FreshTier2Fee INT DEFAULT 25000;');
            console.log('✅ Đã thêm cột FreshTier2Fee vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột FreshTier2Fee đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN FreshTier2Threshold INT DEFAULT 200000;');
            console.log('✅ Đã thêm cột FreshTier2Threshold vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột FreshTier2Threshold đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN PackagingFee INT DEFAULT 5000;');
            console.log('✅ Đã thêm cột PackagingFee vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột PackagingFee đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN GHNToken VARCHAR(255) DEFAULT NULL;');
            console.log('✅ Đã thêm cột GHNToken vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột GHNToken đã tồn tại hoặc lỗi:', e.message); }

        try {
            await connection.query('ALTER TABLE CuaHang ADD COLUMN GHNShopId VARCHAR(50) DEFAULT NULL;');
            console.log('✅ Đã thêm cột GHNShopId vào bảng CuaHang');
        } catch (e) { console.log('⚠️ Cột GHNShopId đã tồn tại hoặc lỗi:', e.message); }

        connection.release();
        console.log('🎉 Migration hoàn tất thành công!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Lỗi chạy migration:', err);
        process.exit(1);
    }
}

migrate();

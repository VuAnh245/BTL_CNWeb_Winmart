const db = require('./src/config/db');

async function updateSchema() {
    try {
        console.log('Đang kết nối database...');
        const connection = await db.pool.getConnection();
        
        // Thêm cột SoDienThoai
        try {
            await connection.query('ALTER TABLE cuahang ADD COLUMN SoDienThoai VARCHAR(20) DEFAULT "" AFTER DiaChi;');
            console.log('Thêm cột SoDienThoai thành công');
        } catch (e) { console.log('Cột SoDienThoai đã tồn tại hoặc lỗi:', e.message); }

        // Thêm cột Email
        try {
            await connection.query('ALTER TABLE cuahang ADD COLUMN Email VARCHAR(100) DEFAULT "" AFTER SoDienThoai;');
            console.log('Thêm cột Email thành công');
        } catch (e) { console.log('Cột Email đã tồn tại hoặc lỗi:', e.message); }

        // Thêm cột BaoTriHeThong
        try {
            await connection.query('ALTER TABLE cuahang ADD COLUMN BaoTriHeThong TINYINT(1) DEFAULT 0;');
            console.log('Thêm cột BaoTriHeThong thành công');
        } catch (e) { console.log('Cột BaoTriHeThong đã tồn tại hoặc lỗi:', e.message); }

        // Thêm cột AmBaoDonHang
        try {
            await connection.query('ALTER TABLE cuahang ADD COLUMN AmBaoDonHang TINYINT(1) DEFAULT 1;');
            console.log('Thêm cột AmBaoDonHang thành công');
        } catch (e) { console.log('Cột AmBaoDonHang đã tồn tại hoặc lỗi:', e.message); }

        // Thêm cột TuDongDuyetPOS
        try {
            await connection.query('ALTER TABLE cuahang ADD COLUMN TuDongDuyetPOS TINYINT(1) DEFAULT 1;');
            console.log('Thêm cột TuDongDuyetPOS thành công');
        } catch (e) { console.log('Cột TuDongDuyetPOS đã tồn tại hoặc lỗi:', e.message); }

        connection.release();
        console.log('Cập nhật Database hoàn tất!');
        process.exit(0);
    } catch (err) {
        console.error('Lỗi toàn cục:', err);
        process.exit(1);
    }
}

updateSchema();

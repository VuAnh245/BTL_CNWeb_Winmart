'use strict';
const db = require('../../config/db');

// Giao diện Cài đặt
async function index(req, res, next) {
    try {
        const [rows] = await db.pool.query('SELECT * FROM cuahang LIMIT 1');
        
        let store = null;
        if (rows.length > 0) {
            store = rows[0];
        } else {
            // Nếu chưa có dữ liệu cửa hàng, tạo mặc định
            await db.pool.query(`
                INSERT INTO cuahang (TenCuaHang, DiaChi, SoDienThoai, Email, is_active, BaoTriHeThong, AmBaoDonHang, GuiEmailTuDong) 
                VALUES ('Winmart Store', '123 Đường ABC, Quận XYZ, TP.HCM', '', '', 1, 0, 1, 1)
            `);
            const [newRows] = await db.pool.query('SELECT * FROM cuahang LIMIT 1');
            store = newRows[0];
        }

        res.render('admin/settings/index', {
            title: 'Cài Đặt Cửa Hàng',
            currentRoute: '/admin/settings',
            user: req.session.user,
            store: store
        });
    } catch (error) {
        next(error);
    }
}

// Cập nhật thông tin cửa hàng
async function update(req, res, next) {
    try {
        const { 
            CuaHangId, TenCuaHang, DiaChi, SoDienThoai, Email,
            BaoTriHeThong, AmBaoDonHang, GuiEmailTuDong,
            FreeShipThreshold, FreshTier1Fee, FreshTier2Fee, FreshTier2Threshold, PackagingFee,
            GHNToken, GHNShopId, GHNProvinceId, GHNDistrictId, GHNWardCode
        } = req.body;

        if (!TenCuaHang || !DiaChi) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Tên và Địa chỉ cửa hàng' });
        }

        const isBaoTri = BaoTriHeThong ? 1 : 0;
        const isAmBao = AmBaoDonHang ? 1 : 0;
        const isGuiEmail = GuiEmailTuDong ? 1 : 0;

        await db.pool.query(`
            UPDATE cuahang 
            SET TenCuaHang = ?, DiaChi = ?, SoDienThoai = ?, Email = ?,
                BaoTriHeThong = ?, AmBaoDonHang = ?, GuiEmailTuDong = ?,
                FreeShipThreshold = ?, FreshTier1Fee = ?, FreshTier2Fee = ?, FreshTier2Threshold = ?, PackagingFee = ?,
                GHNToken = ?, GHNShopId = ?, GHNProvinceId = ?, GHNDistrictId = ?, GHNWardCode = ?,
                NgayCapNhat = NOW() 
            WHERE CuaHangId = ?
        `, [
            TenCuaHang, DiaChi, SoDienThoai || '', Email || '', isBaoTri, isAmBao, isGuiEmail,
            parseInt(FreeShipThreshold, 10) || 0,
            parseInt(FreshTier1Fee, 10) || 0,
            parseInt(FreshTier2Fee, 10) || 0,
            parseInt(FreshTier2Threshold, 10) || 0,
            parseInt(PackagingFee, 10) || 0,
            GHNToken || null,
            GHNShopId || null,
            parseInt(GHNProvinceId, 10) || null,
            parseInt(GHNDistrictId, 10) || null,
            GHNWardCode || null,
            CuaHangId
        ]);

        res.json({ success: true, message: 'Đã cập nhật thông tin cài đặt thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    index,
    update
};

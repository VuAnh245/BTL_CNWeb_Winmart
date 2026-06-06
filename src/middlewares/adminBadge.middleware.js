const db = require('../config/db');

const timeAgo = (date) => {
    if (!date) return "Vừa cập nhật";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval >= 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) + " phút trước";
    return "Vài giây trước";
};

const adminBadgeMiddleware = async (req, res, next) => {
    try {
        // Execute queries in parallel for performance
        const [ordersResult, productsResult, usersResult, reportsResult] = await Promise.all([
            // 1. Pending orders
            db.pool.query('SELECT COUNT(*) as count, MAX(NgayLap) as last_update FROM HoaDonBanHang WHERE TrangThai = "Pending"'),
            // 2. Low stock products (Tong Ton Kho <= MucCanDat)
            db.pool.query('SELECT COUNT(*) as count, MAX(NgayCapNhat) as last_update FROM SanPham sp WHERE (SELECT COALESCE(SUM(SoLuongHienTai), 0) FROM LoHangTonKho WHERE SanPhamId = sp.SanPhamId AND TrangThai = "Available") <= sp.MucCanDat'),
            // 3. Active employees
            db.pool.query('SELECT COUNT(*) as count, MAX(NgayCapNhat) as last_update FROM NhanVien WHERE TrangThai = "Active"'),
            // 4. Completed orders today (representing daily reports)
            db.pool.query('SELECT COUNT(*) as count, MAX(NgayLap) as last_update FROM HoaDonBanHang WHERE TrangThai = "Completed" AND DATE(NgayLap) = CURDATE()')
        ]);

        // Inject into res.locals so all admin views can access it
        res.locals.adminBadges = {
            orders: ordersResult[0][0].count || 0,
            ordersTime: timeAgo(ordersResult[0][0].last_update),
            products: productsResult[0][0].count || 0,
            productsTime: timeAgo(productsResult[0][0].last_update),
            users: usersResult[0][0].count || 0,
            usersTime: timeAgo(usersResult[0][0].last_update),
            reports: reportsResult[0][0].count || 0,
            reportsTime: timeAgo(reportsResult[0][0].last_update)
        };

        next();
    } catch (error) {
        console.error('Error in adminBadgeMiddleware:', error);
        // Fallback to zeros if error occurs to avoid crashing the UI
        res.locals.adminBadges = { orders: 0, products: 0, users: 0, reports: 0, ordersTime: '', productsTime: '', usersTime: '', reportsTime: '' };
        next();
    }
};

module.exports = adminBadgeMiddleware;

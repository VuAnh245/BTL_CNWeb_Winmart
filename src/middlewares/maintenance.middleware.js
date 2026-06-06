'use strict';
const db = require('../config/db');

module.exports = async function maintenanceMiddleware(req, res, next) {
    try {
        res.locals.isMaintenance = false;
        res.locals.storeInfo = {};
        
        const [rows] = await db.pool.query('SELECT * FROM cuahang LIMIT 1');
        if (rows.length > 0) {
            res.locals.storeInfo = rows[0];
            if (rows[0].BaoTriHeThong === 1) {
                res.locals.isMaintenance = true;
            }
        }

        // Bỏ qua các route quản trị
        if (req.path.startsWith('/admin') || req.path.startsWith('/staff') || req.path.startsWith('/auth')) {
            return next();
        }

        // Nếu đang bảo trì, CẤM các đường dẫn mua sắm
        if (res.locals.isMaintenance) {
            const blockedRoutes = ['/products', '/cart', '/checkout'];
            const isBlocked = blockedRoutes.some(route => req.path === route || req.path.startsWith(route + '/'));
            
            if (isBlocked && req.path !== '/maintenance') {
                return res.redirect('/maintenance');
            }
        }

        next();
    } catch (error) {
        console.error('Lỗi middleware bảo trì:', error);
        res.locals.isMaintenance = false;
        next(); 
    }
};

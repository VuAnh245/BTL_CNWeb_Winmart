// src/routes/admin.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// ✅ FIX QUAN TRỌNG: Set layout qua res.locals
// express-ejs-layouts@2.5.1 chỉ đọc layout từ res.locals, không đọc từ res.render() options
router.use((req, res, next) => {
  res.locals.layout = 'layouts/admin';
  next();
});

// Middleware bảo vệ route: Yêu cầu đăng nhập + chỉ ADMIN
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// Lấy thông báo động cho Sidebar
const adminBadgeMiddleware = require('../middlewares/adminBadge.middleware');
router.use(adminBadgeMiddleware);

const dashboardController = require('../controllers/admin/dashboard.controller');
const notificationController = require('../controllers/admin/notification.controller');
const profileController = require('../controllers/admin/profile.controller');

// Profile routes
router.get('/profile', profileController.getProfile);
router.post('/profile', profileController.updateProfile);

// GET: Admin Dashboard
router.get('/', dashboardController.getDashboard);

// Thông báo
router.get('/notifications', notificationController.index);
router.get('/api/check-new-orders', notificationController.checkNewOrders);

// ✅ Quản lý sản phẩm, danh mục, nhà cung cấp
const productRoutes = require('./admin/product.routes');
const categoryRoutes = require('./admin/category.routes');
const supplierRoutes = require('./admin/supplier.routes');
const userRoutes = require('./admin/user.routes');
const customerRoutes = require('./admin/customer.routes');
const orderRoutes = require('./admin/order.routes');
const inventoryRoutes = require('./admin/inventory.routes');
const promotionRoutes = require('./admin/promotion.routes');
const statisticsRoutes = require('./admin/statistics.routes');
const settingRoutes = require('./admin/setting.routes');

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/promotions', promotionRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/settings', settingRoutes);

module.exports = router;
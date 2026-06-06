const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Set layout cho POS
router.use((req, res, next) => {
  res.locals.layout = 'layouts/pos';
  next();
});

// Middleware bảo vệ route: Yêu cầu đăng nhập + STAFF hoặc ADMIN
router.use(requireAuth);
router.use(requireRole('STAFF', 'ADMIN'));

// Chuyển hướng mặc định
router.get('/', (req, res) => {
  res.redirect('/staff/pos');
});

const posController = require('../controllers/staff/pos.controller');
const invoiceController = require('../controllers/staff/invoice.controller');
const lookupController = require('../controllers/staff/lookup.controller');
const customerController = require('../controllers/staff/customer.controller');

// GET: Giao diện POS
router.get('/pos', posController.getPOS);

// GET: Giao diện Đơn Hàng (Staff)
router.get('/orders', invoiceController.listInvoices);
router.get('/orders/:id/print', invoiceController.printInvoice);

// GET: Giao diện Tồn Kho (Staff)
router.get('/inventory', lookupController.listInventory);
router.get('/api/inventory/:id', lookupController.getProductDetailAPI);

// GET: Giao diện Khách Hàng (Staff)
router.get('/customers', customerController.listCustomers);
router.get('/api/customers/:id', customerController.getCustomerDetailAPI);

// API: Tìm kiếm sản phẩm
router.get('/api/pos/products', posController.searchProductsAPI);

// API: Thanh toán POS
router.post('/api/pos/checkout', posController.processCheckoutAPI);
router.get('/api/pos/check-payment/:orderCode', posController.checkPaymentAPI);

// API: Khách hàng POS
router.get('/api/pos/customers/search', posController.searchCustomerAPI);
router.post('/api/pos/customers', posController.registerCustomerAPI);

// API: Mã giảm giá
router.post('/api/pos/validate-promo', posController.validatePromoAPI);

// Lấy chi tiết đơn hàng cho modal
router.get('/api/orders/:id', invoiceController.getOrderDetailAPI);

module.exports = router;

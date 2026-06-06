const express = require('express');
const router = express.Router();
const checkoutController = require('../../controllers/client/checkout.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

// Webhooks / IPN (No Auth required)
router.get('/vnpay_ipn', checkoutController.vnpayIpn);
router.post('/momo_ipn', checkoutController.momoIpn);

// Protect all checkout routes
router.use(requireAuth);

router.get('/', checkoutController.index);
router.post('/process', checkoutController.process);
router.post('/validate-promo', checkoutController.validatePromo);
router.get('/payment/:orderCode', checkoutController.payment);
router.post('/payment/process', checkoutController.processPayment);
router.get('/success', checkoutController.success);

// Returns
router.get('/vnpay_return', checkoutController.vnpayReturn);
router.get('/momo_return', checkoutController.momoReturn);

module.exports = router;

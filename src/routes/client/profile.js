const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/client/profile.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/', profileController.index);
router.post('/update', profileController.update);

router.get('/orders', profileController.orders);
router.get('/orders/:id', profileController.orderDetail);
router.post('/orders/:id/cancel', profileController.cancelOrder);

router.get('/wishlist', profileController.wishlist);
router.get('/address', profileController.address);

router.get('/change-password', profileController.getChangePassword);
router.post('/change-password', profileController.postChangePassword);

module.exports = router;

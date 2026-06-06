const express = require('express');
const router = express.Router();
const homeController = require('../../controllers/client/home.controller');
const productController = require('../../controllers/client/product.controller');
const authController = require('../../controllers/client/auth.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

const cartRoutes = require('./cart');
const checkoutRoutes = require('./checkout');
const profileRoutes = require('./profile');

// Pages
router.get('/', homeController.index);
router.get('/products', productController.list);
router.get('/products/:id', productController.detail);
router.get('/promotions', homeController.promotions);
router.get('/contact', homeController.contact);

// Auth (Public)
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Cart
const cartRouter = require('./cart');
router.use('/cart', cartRouter);

// Checkout
router.use('/checkout', checkoutRoutes);

// Profile
const profileRouter = require('./profile');
router.use('/profile', profileRouter);

module.exports = router;
'use strict';

const express = require('express');
const router = express.Router();
const productController = require('../../controllers/admin/product.controller');
const { uploadImage } = require('../../middlewares/upload.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const productSchema = require('../../validations/product.validation');

// GET /admin/products
router.get('/', productController.list);

// GET /admin/products/create
router.get('/create', productController.showCreateForm);

// POST /admin/products/create
router.post('/create', uploadImage('HinhAnh'), validate(productSchema.create), productController.create);

// GET /admin/products/:id (Xem chi tiết)
router.get('/:id', productController.getDetail);

// GET /admin/products/:id/edit
router.get('/:id/edit', productController.showEditForm);

// POST /admin/products/:id/edit
router.post('/:id/edit', uploadImage('HinhAnh'), validate(productSchema.update), productController.update);

// POST /admin/products/:id/delete
router.post('/:id/delete', productController.deleteProduct);

// GET /admin/products/:id/print-barcode
router.get('/:id/print-barcode', productController.printBarcode);

module.exports = router;

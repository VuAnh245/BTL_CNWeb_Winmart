'use strict';
const express = require('express');
const router = express.Router();
const receiptController = require('../../controllers/admin/receipt.controller');
const { validate } = require('../../middlewares/validate.middleware');
const inventorySchema = require('../../validations/inventory.validation');

// Danh sách phiếu nhập
router.get('/', receiptController.index);

// Giao diện tạo phiếu nhập
router.get('/create', receiptController.getCreate);

// API lưu phiếu nhập
router.post('/create', validate(inventorySchema.createReceipt), receiptController.postCreate);

// Chi tiết phiếu nhập
router.get('/:id', receiptController.getDetail);

// Duyệt / Hủy phiếu
router.post('/:id/approve', receiptController.approveReceipt);
router.post('/:id/cancel', receiptController.cancelReceipt);

module.exports = router;

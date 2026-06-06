'use strict';

const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/admin/order.controller');

// GET /admin/orders
router.get('/', orderController.list);

// GET /admin/orders/:id (Xem chi tiết)
router.get('/:id', orderController.getDetail);

// POST /admin/orders/:id/status
router.post('/:id/status', orderController.updateStatus);

// GET /admin/orders/:id/print
router.get('/:id/print', orderController.printReceipt);

// POST /admin/orders/:id/refund
router.post('/:id/refund', orderController.processRefund);

// POST /admin/orders/:id/ghn/create
router.post('/:id/ghn/create', orderController.createGHNOrderManual);

// POST /admin/orders/:id/ghn/cancel
router.post('/:id/ghn/cancel', orderController.cancelGHNOrderManual);

// POST /admin/orders/:id/ghn/sync
router.post('/:id/ghn/sync', orderController.syncGHNStatus);
router.get('/:id/ghn/sync', orderController.syncGHNStatus);

module.exports = router;

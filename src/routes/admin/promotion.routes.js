'use strict';
const express = require('express');
const router = express.Router();
const promotionController = require('../../controllers/admin/promotion.controller');
const { validate } = require('../../middlewares/validate.middleware');
const promotionSchema = require('../../validations/promotion.validation');

// Danh sách mã giảm giá
router.get('/', promotionController.index);

// Lấy trạng thái gửi email (phải đặt trước /:id/edit để không bị bắt nhầm)
router.get('/queue-status', promotionController.getQueueStatus);

// Giao diện tạo mã giảm giá
router.get('/create', promotionController.getCreate);

// Lưu mã giảm giá
router.post('/create', validate(promotionSchema.create), promotionController.postCreate);

// Giao diện sửa mã giảm giá
router.get('/:id/edit', promotionController.getEdit);

// Lưu cập nhật mã giảm giá
router.post('/:id/edit', validate(promotionSchema.update), promotionController.postEdit);

// Thay đổi trạng thái/Xóa (Soft delete hoặc đổi trạng thái)
router.post('/:id/toggle', promotionController.postToggle);

// Phát (Broadcast) mã giảm giá qua Email Queue
router.post('/:id/broadcast', promotionController.postBroadcast);

module.exports = router;

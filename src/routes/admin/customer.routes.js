'use strict';
const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/admin/customer.controller');
const { validate } = require('../../middlewares/validate.middleware');
const userSchema = require('../../validations/user.validation');

// Danh sách khách hàng
router.get('/', customerController.list);

// Chi tiết khách hàng (Lịch sử đơn hàng, Điểm tích lũy)
router.get('/:id', customerController.detail);

// Thêm khách hàng mới
router.post('/', validate(userSchema.customerCreate), customerController.create);

// Cập nhật thông tin khách hàng
router.post('/:id/update', validate(userSchema.customerUpdate), customerController.update);

// Cập nhật cấp độ VIP thủ công
router.post('/:id/update-tier', customerController.updateTier);

// Đổi trạng thái (Khóa/Mở khóa)
router.post('/:id/toggle-status', customerController.toggleStatus);

// Điều chỉnh điểm tích lũy
router.post('/:id/adjust-points', customerController.adjustPoints);

module.exports = router;

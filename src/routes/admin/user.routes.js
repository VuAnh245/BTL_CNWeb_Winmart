'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../../controllers/admin/user.controller');
const { validate } = require('../../middlewares/validate.middleware');
const userSchema = require('../../validations/user.validation');

// Danh sách nhân viên
router.get('/', userController.list);

// Thêm mới nhân viên
router.get('/create', userController.createForm);
router.post('/create', validate(userSchema.staffCreate), userController.create);

// Sửa nhân viên
router.get('/:id/edit', userController.editForm);
router.post('/:id/edit', validate(userSchema.staffUpdate), userController.update);

// Chuyển trạng thái nghỉ việc / xóa
router.post('/:id/delete', userController.delete);

module.exports = router;

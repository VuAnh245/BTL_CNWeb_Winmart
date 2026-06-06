'use strict';

const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/admin/category.controller');
const { validate } = require('../../middlewares/validate.middleware');
const categorySchema = require('../../validations/category.validation');

// GET /admin/categories
router.get('/', categoryController.list);

// GET /admin/categories/create
router.get('/create', categoryController.showCreateForm);

// POST /admin/categories/create
router.post('/create', validate(categorySchema.create), categoryController.create);

// GET /admin/categories/:id/edit
router.get('/:id/edit', categoryController.showEditForm);

// POST /admin/categories/:id/edit
router.post('/:id/edit', validate(categorySchema.update), categoryController.update);

// POST /admin/categories/:id/delete
router.post('/:id/delete', categoryController.deleteCategory);

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const supplierController = require('../../controllers/admin/supplier.controller');
const { validate } = require('../../middlewares/validate.middleware');
const supplierSchema = require('../../validations/supplier.validation');

// GET /admin/suppliers
router.get('/', supplierController.list);

// GET /admin/suppliers/create
router.get('/create', supplierController.showCreateForm);

// POST /admin/suppliers/create
router.post('/create', validate(supplierSchema.create), supplierController.create);

// GET /admin/suppliers/:id/edit
router.get('/:id/edit', supplierController.showEditForm);

// POST /admin/suppliers/:id/edit
router.post('/:id/edit', validate(supplierSchema.update), supplierController.update);

// POST /admin/suppliers/:id/delete
router.post('/:id/delete', supplierController.deleteSupplier);

module.exports = router;

'use strict';
const express = require('express');
const router = express.Router();
const settingController = require('../../controllers/admin/setting.controller');

router.get('/', settingController.index);
router.post('/update', settingController.update);

module.exports = router;

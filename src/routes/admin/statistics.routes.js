'use strict';
const express = require('express');
const router = express.Router();
const statisticsController = require('../../controllers/admin/statistics.controller');

// Trang thống kê chính
router.get('/', statisticsController.index);

// Xuất báo cáo Excel
router.get('/export/excel', statisticsController.exportExcel);

// Xuất báo cáo PDF (in ấn)
router.get('/export/pdf', statisticsController.exportPdf);

module.exports = router;

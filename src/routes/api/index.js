'use strict';

const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/api/webhook.controller');

// ĐVVC Webhook
router.post('/webhooks/shipping', webhookController.shippingWebhook);

// GHN Master Data & Routing
const ghnApiController = require('../../controllers/api/ghn.api.controller');
router.get('/ghn/provinces', ghnApiController.getProvinces);
router.get('/ghn/districts/:provinceId', ghnApiController.getDistricts);
router.get('/ghn/wards/:districtId', ghnApiController.getWards);
router.post('/ghn/calculate-fee', ghnApiController.calculateCartFee);
router.post('/ghn/test-connection', ghnApiController.testConnection);

module.exports = router;

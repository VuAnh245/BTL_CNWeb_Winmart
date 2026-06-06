const express = require('express');
const router = express.Router();

// Chuyển hướng trang chủ về Client
router.get('/', (req, res) => {
  res.redirect('/client');
});

// Health check
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'WinMart API is running' });
});

module.exports = router;
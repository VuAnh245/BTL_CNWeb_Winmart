const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/client/cart.controller');

router.post('/add', cartController.add);
router.post('/update', cartController.update);
router.post('/remove', cartController.remove);
router.get('/', cartController.index);

module.exports = router;

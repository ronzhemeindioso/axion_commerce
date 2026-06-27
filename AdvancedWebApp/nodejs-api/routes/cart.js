const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.post('/checkout', cartController.checkout);
router.get('/:user_id', cartController.getCart);
router.post('/', cartController.addToCart);
router.put('/:id', cartController.updateCart);
router.delete('/:id', cartController.deleteCart);

module.exports = router;
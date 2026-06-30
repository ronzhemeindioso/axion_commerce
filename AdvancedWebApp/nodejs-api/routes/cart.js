const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/auth');

router.post('/checkout', verifyToken, cartController.checkout);
router.get('/:user_id', verifyToken, cartController.getCart);
router.post('/', verifyToken, cartController.addToCart);
router.put('/:id', verifyToken, cartController.updateCart);
router.delete('/:id', verifyToken, cartController.deleteCart);

module.exports = router;
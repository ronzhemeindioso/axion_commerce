const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, orderController.getAll);
router.get('/user/:user_id', verifyToken, orderController.getByUser);
router.get('/:id', verifyToken, orderController.getOne);
router.put('/:id/status', verifyToken, isAdmin, orderController.updateStatus);
router.delete('/:id', verifyToken, isAdmin, orderController.deleteOrder);

module.exports = router;
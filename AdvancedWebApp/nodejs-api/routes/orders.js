const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/', orderController.getAll);
router.get('/user/:user_id', orderController.getByUser);
router.get('/:id', orderController.getOne);
router.put('/:id/status', orderController.updateStatus);
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
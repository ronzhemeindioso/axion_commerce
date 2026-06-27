const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/users', authController.getAll);
router.put('/users/:id/role', authController.updateRole);
router.put('/users/:id/toggle', authController.toggleActive);

module.exports = router;
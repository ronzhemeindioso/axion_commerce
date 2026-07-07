const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/login', authController.login);
router.post('/logout', verifyToken, authController.logout);
router.get('/users', verifyToken, isAdmin, authController.getAll);
router.put('/users/:id/role', verifyToken, isAdmin, authController.updateRole);
router.put('/users/:id/toggle', verifyToken, isAdmin, authController.toggleActive);
router.post('/profile/setup', verifyToken, authController.setupProfile);
router.post('/profile/setup/skip', verifyToken, authController.skipProfileSetup);
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
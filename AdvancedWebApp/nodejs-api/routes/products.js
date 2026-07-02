const express = require('express');
const router = express.Router();
const productController = require('../controllers/productControllerSeq');
const { verifyToken, isAdmin } = require('../middleware/auth');

// /search MUST be before /:id or Express will treat "search" as an id
router.get('/search', productController.search);

// deleted-products routes MUST also be before /:id
router.get('/deleted/all', verifyToken, isAdmin, productController.getDeleted);
router.patch('/:id/restore', verifyToken, isAdmin, productController.restore);
router.delete('/:id/permanent', verifyToken, isAdmin, productController.hardDelete);

router.get('/', productController.getAll);
router.get('/:id', productController.getOne);
router.post('/', verifyToken, isAdmin, productController.upload.array('images', 5), productController.handleUploadError, productController.create);
router.put('/:id', verifyToken, isAdmin, productController.upload.array('images', 5), productController.handleUploadError, productController.update);
router.delete('/:id', verifyToken, isAdmin, productController.delete);

module.exports = router;
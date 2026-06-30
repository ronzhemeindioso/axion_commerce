const express = require('express');
const router = express.Router();
const productController = require('../controllers/productControllerSeq');
const { verifyToken, isAdmin } = require('../middleware/auth');

// /search MUST be before /:id or Express will treat "search" as an id
router.get('/search', productController.search);

router.get('/', productController.getAll);
router.get('/:id', productController.getOne);
router.post('/', verifyToken, isAdmin, productController.upload.array('images', 5), productController.create);
router.put('/:id', verifyToken, isAdmin, productController.upload.array('images', 5), productController.update);
router.delete('/:id', verifyToken, isAdmin, productController.delete);

module.exports = router;
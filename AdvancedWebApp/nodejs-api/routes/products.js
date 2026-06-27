const express = require('express');
const router = express.Router();
const productController = require('../controllers/productControllerSeq');

// /search MUST be before /:id or Express will treat "search" as an id
router.get('/search', productController.search);

router.get('/', productController.getAll);
router.get('/:id', productController.getOne);
router.post('/', productController.upload.array('images', 5), productController.create);
router.put('/:id', productController.upload.array('images', 5), productController.update);
router.delete('/:id', productController.delete);

module.exports = router;
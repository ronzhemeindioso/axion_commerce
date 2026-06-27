const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemControllerSeq');

router.get('/', itemController.getAll);
router.get('/:id', itemController.getOne);
router.post('/', itemController.upload.array('images', 5), itemController.create);
router.put('/:id', itemController.upload.array('images', 5), itemController.update);
router.delete('/:id', itemController.delete);

module.exports = router;
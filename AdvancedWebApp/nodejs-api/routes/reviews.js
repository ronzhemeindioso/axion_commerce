const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/auth');

router.get('/summary', reviewController.getRatingSummaries);
router.get('/mine', verifyToken, reviewController.getMyReviews);
router.get('/product/:product_id', reviewController.getReviewsByProduct);
router.post('/', verifyToken, reviewController.createReview);
router.put('/:id', verifyToken, reviewController.updateReview);
router.delete('/:id', verifyToken, reviewController.deleteReview);

module.exports = router;
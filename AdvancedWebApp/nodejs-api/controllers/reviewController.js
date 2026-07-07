const { Op, fn, col } = require('sequelize');
const Review = require('../sequelize/models/Review');
const Order = require('../sequelize/models/Order');
const OrderItem = require('../sequelize/models/OrderItem');
const User = require('../sequelize/models/User');

// CREATE a review — only allowed if the order belongs to this user,
// is delivered, and actually contains this product.
exports.createReview = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const { product_id, order_id, rating, comment } = req.body;

        if (!product_id || !order_id || !rating) {
            return res.status(400).json({ message: 'product_id, order_id, and rating are required' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const order = await Order.findByPk(order_id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.user_id !== user_id) {
            return res.status(403).json({ message: 'This order does not belong to you' });
        }
        if ((order.status || '').toLowerCase() !== 'delivered') {
            return res.status(400).json({ message: 'You can only review items from delivered orders' });
        }

        const orderItem = await OrderItem.findOne({ where: { order_id, product_id } });
        if (!orderItem) {
            return res.status(400).json({ message: 'This product was not part of that order' });
        }

        const existing = await Review.findOne({ where: { user_id, product_id, order_id } });
        if (existing) {
            return res.status(409).json({ message: 'You already reviewed this item for this order' });
        }

        const review = await Review.create({ user_id, product_id, order_id, rating, comment });
        res.status(201).json(review);
    } catch (err) {
        next(err);
    }
};

// UPDATE a review — only the review's own author can edit it.
exports.updateReview = async (req, res, next) => {
    try {
        const review = await Review.findByPk(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        if (review.user_id !== req.user.id) {
            return res.status(403).json({ message: 'You can only edit your own reviews' });
        }

        const { rating, comment } = req.body;
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        await review.update({
            rating: rating !== undefined ? rating : review.rating,
            comment: comment !== undefined ? comment : review.comment
        });

        res.json(review);
    } catch (err) {
        next(err);
    }
};

// DELETE a review — the author can delete their own, admins can delete any (moderation).
exports.deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findByPk(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        const isOwner = review.user_id === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'You are not allowed to delete this review' });
        }

        await review.destroy();
        res.json({ message: 'Review deleted' });
    } catch (err) {
        next(err);
    }
};

// GET paginated reviews for a single product, newest first, plus the
// overall average rating and review count (computed across ALL reviews,
// not just the current page).
exports.getReviewsByProduct = async (req, res, next) => {
    try {
        const product_id = req.params.product_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const { count, rows } = await Review.findAndCountAll({
            where: { product_id },
            include: [{ model: User, attributes: ['name'] }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        const summary = await Review.findOne({
            where: { product_id },
            attributes: [
                [fn('AVG', col('rating')), 'average'],
                [fn('COUNT', col('id')), 'total']
            ],
            raw: true
        });

        res.json({
            reviews: rows,
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
            average: summary && summary.average ? parseFloat(summary.average) : 0,
            count: summary && summary.total ? parseInt(summary.total) : 0
        });
    } catch (err) {
        next(err);
    }
};

// GET all reviews written by the currently logged-in user — used by the
// order history page to know which delivered items already have a review.
exports.getMyReviews = async (req, res, next) => {
    try {
        const reviews = await Review.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        res.json(reviews);
    } catch (err) {
        next(err);
    }
};

// GET average rating + count for MULTIPLE products at once — used on
// listing pages (e.g. the shop grid) so it doesn't need one request per card.
exports.getRatingSummaries = async (req, res, next) => {
    try {
        const idsParam = req.query.product_ids;
        if (!idsParam) {
            return res.status(400).json({ message: 'product_ids query param is required' });
        }

        const productIds = idsParam.split(',').map(id => parseInt(id)).filter(Boolean);

        const summaries = await Review.findAll({
            where: { product_id: { [Op.in]: productIds } },
            attributes: [
                'product_id',
                [fn('AVG', col('rating')), 'average'],
                [fn('COUNT', col('id')), 'count']
            ],
            group: ['product_id'],
            raw: true
        });

        const result = summaries.map(s => ({
            product_id: s.product_id,
            average: parseFloat(s.average),
            count: parseInt(s.count)
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
};
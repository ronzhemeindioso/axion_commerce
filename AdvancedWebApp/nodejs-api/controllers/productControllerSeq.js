const { Op } = require('sequelize');
const Product = require('../sequelize/models/Product');
const multer = require('multer');

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

const upload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});
exports.upload = upload;

// Handles multer errors (e.g. file too large) with a friendly message
exports.handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Photo must be under 2MB.' });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
};

// Low-stock threshold — products at/below this (but not soft-deleted) trigger the admin banner.
// Matches the existing stock-pill "warn" cutoff used in products.html.
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 10;

// GET /api/products/alerts/low-stock — admin-only, powers the site-wide banner
exports.getLowStockAlerts = async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { stock: { [Op.lte]: LOW_STOCK_THRESHOLD } },
            attributes: ['id', 'name', 'stock'],
            order: [['stock', 'ASC']]
        });

        res.json({
            threshold: LOW_STOCK_THRESHOLD,
            count: products.length,
            outOfStockCount: products.filter(p => p.stock === 0).length,
            products
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET all products (supports ?page=&limit= for infinite scroll)
exports.getAll = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;

        const { count, rows } = await Product.findAndCountAll({
            limit,
            offset,
            order: [['id', 'DESC']]
        });

        res.json({
            data:       rows,
            total:      count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            hasMore:    offset + rows.length < count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET single product
exports.getOne = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST create product
exports.create = async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;
        const images = req.files ? req.files.map(f => f.filename).join(',') : '';
        const product = await Product.create({ name, description, price, stock, category, images });
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT update product
exports.update = async (req, res) => {
    try {
        const { name, description, price, stock, category, keepImages } = req.body;
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const newFilenames = req.files ? req.files.map(f => f.filename) : [];

        let images;
        if (typeof keepImages !== 'undefined') {
            // Client tells us exactly which existing images survived (it may
            // have removed some individually), so combine those with any
            // newly uploaded files instead of an all-or-nothing replace.
            const kept = keepImages ? keepImages.split(',').filter(Boolean) : [];
            images = kept.concat(newFilenames).join(',');
        } else {
            // Backward-compatible fallback for older clients that don't send keepImages
            images = newFilenames.length > 0 ? newFilenames.join(',') : product.images;
        }

        await product.update({ name, description, price, stock, category, images });
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE product
exports.delete = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await product.destroy();
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/products/search?q=keyword
exports.search = async (req, res) => {
    try {
        const q = req.query.q?.trim();
        if (!q || q.length < 1) return res.json([]);

        const results = await Product.findAll({
            where: {
                [Op.or]: [
                    { name:        { [Op.like]: `%${q}%` } },
                    { description: { [Op.like]: `%${q}%` } },
                    { category:    { [Op.like]: `%${q}%` } }
                ]
            },
            attributes: ['id', 'name', 'description', 'price', 'category', 'images'],
            limit: 8,
            order: [['name', 'ASC']]
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/products/deleted/all — list soft-deleted products (admin)
exports.getDeleted = async (req, res) => {
    try {
        const products = await Product.findAll({
            paranoid: false,
            where: { deleted_at: { [Op.ne]: null } },
            order: [['deleted_at', 'DESC']]
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/products/:id/restore — restore a soft-deleted product (admin)
// PATCH /api/products/:id/restore — restore a soft-deleted product (admin)
exports.restore = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, { paranoid: false });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (!product.deleted_at) return res.status(400).json({ message: 'Product is not deleted' });

        await product.restore();
        res.json({ message: 'Product restored successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/products/:id/permanent — permanently delete (hard delete, admin)
exports.hardDelete = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, { paranoid: false });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await product.destroy({ force: true });
        res.json({ message: 'Product permanently deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
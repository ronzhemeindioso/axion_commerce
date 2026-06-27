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

const upload = multer({ storage });
exports.upload = upload;

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
        const { name, description, price, stock, category } = req.body;
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const images = req.files && req.files.length > 0
            ? req.files.map(f => f.filename).join(',')
            : product.images;

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
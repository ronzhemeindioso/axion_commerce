const db = require('../config/db');
const multer = require('multer');
const path = require('path');

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
exports.getAll = (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 12);
    const offset = (page - 1) * limit;

    db.query('SELECT COUNT(*) AS total FROM products', (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const total = countResult[0].total;

        db.query(
            'SELECT * FROM products ORDER BY id DESC LIMIT ? OFFSET ?',
            [limit, offset],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    data:       rows,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasMore:    offset + rows.length < total
                });
            }
        );
    });
};

// GET single product
exports.getOne = (req, res) => {
    db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Product not found' });
        res.json(results[0]);
    });
};

// POST create product with images
exports.create = (req, res) => {
    const { name, description, price, stock, category } = req.body;
    const images = req.files ? req.files.map(f => f.filename).join(',') : '';
    db.query('INSERT INTO products (name, description, price, stock, category, images) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description, price, stock, category, images],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: results.insertId, name, description, price, stock, category, images });
        });
};

// PUT update product with images
exports.update = (req, res) => {
    const { name, description, price, stock, category } = req.body;
    const id = req.params.id;

    if (req.files && req.files.length > 0) {
        const images = req.files.map(f => f.filename).join(',');
        db.query('UPDATE products SET name=?, description=?, price=?, stock=?, category=?, images=? WHERE id=?',
            [name, description, price, stock, category, images, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Product updated successfully' });
            });
    } else {
        db.query('UPDATE products SET name=?, description=?, price=?, stock=?, category=? WHERE id=?',
            [name, description, price, stock, category, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Product updated successfully' });
            });
    }
};

// DELETE product
exports.delete = (req, res) => {
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product deleted successfully' });
    });
};


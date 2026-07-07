const { Op } = require('sequelize');
const Product = require('../sequelize/models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Only these extensions are ever accepted — matched against the uploaded
// file's own name, never trusted beyond that (see verifyImageContents below,
// which checks the actual file bytes too).
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // The client's original filename is NEVER used to build the saved
        // path — only its extension is read, and only if that extension is
        // on the whitelist. This avoids path-traversal payloads (e.g. a
        // filename containing "../../") and collisions/overwrites, since the
        // actual name on disk is always a random, unrelated string.
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Only .jpg, .jpeg, .png, .gif, and .webp files are allowed'));
        }
        const randomName = crypto.randomBytes(16).toString('hex');
        cb(null, `${randomName}${ext}`);
    }
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

const upload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (req, file, cb) => {
        // This mimetype check is a fast first-pass filter only — it's a
        // header the uploader's own client sets and is trivially spoofable,
        // so it's never relied on by itself. verifyImageContents (below)
        // does the check that actually matters, on the real file bytes.
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});
exports.upload = upload;

// Magic-byte signatures for each allowed image format. Checking these bytes
// (rather than the file extension or the client-supplied mimetype) confirms
// what the file actually IS, not just what it's labeled as — this is what
// stops someone from renaming a non-image file to look like an image.
const IMAGE_SIGNATURES = [
    { format: 'png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { format: 'jpeg', bytes: [0xFF, 0xD8, 0xFF] },
    { format: 'gif',  bytes: [0x47, 0x49, 0x46, 0x38] } // "GIF8"
    // webp is checked separately below (RIFF....WEBP, not a single contiguous prefix)
];

function matchesKnownImageSignature(buffer) {
    if (buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP') {
        return true;
    }
    return IMAGE_SIGNATURES.some(sig =>
        buffer.length >= sig.bytes.length &&
        sig.bytes.every((byte, i) => buffer[i] === byte)
    );
}

// Middleware — runs after multer has saved the file(s) to disk, and before
// the create/update handler touches the database. Reads the first few bytes
// of each uploaded file and rejects (deleting the file) if they don't match
// a real image signature, regardless of what extension or mimetype claimed.
exports.verifyImageContents = (req, res, next) => {
    const files = req.files || [];
    if (files.length === 0) return next();

    try {
        for (const file of files) {
            const fd = fs.openSync(file.path, 'r');
            const headerBuffer = Buffer.alloc(12);
            fs.readSync(fd, headerBuffer, 0, 12, 0);
            fs.closeSync(fd);

            if (!matchesKnownImageSignature(headerBuffer)) {
                // Clean up every file from this request before rejecting,
                // so no bogus file is left sitting in /uploads.
                files.forEach(f => {
                    fs.unlink(f.path, () => {});
                });
                return res.status(400).json({ message: 'One or more uploaded files are not valid images.' });
            }
        }
        next();
    } catch (err) {
        files.forEach(f => {
            fs.unlink(f.path, () => {});
        });
        res.status(500).json({ message: 'Failed to verify uploaded file contents.' });
    }
};

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
exports.getLowStockAlerts = async (req, res, next) => {
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
        next(err);
    }
};

// GET all products (supports ?page=&limit= for infinite scroll)
exports.getAll = async (req, res, next) => {
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
        next(err);
    }
};

// GET single product
exports.getOne = async (req, res, next) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        next(err);
    }
};

// POST create product
exports.create = async (req, res, next) => {
    try {
        const { name, description, price, stock, category } = req.body;
        const images = req.files ? req.files.map(f => f.filename).join(',') : '';
        const product = await Product.create({ name, description, price, stock, category, images });
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
};

// PUT update product
exports.update = async (req, res, next) => {
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
        next(err);
    }
};

// DELETE product
exports.delete = async (req, res, next) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await product.destroy();
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        next(err);
    }
};

// GET /api/products/search?q=keyword
exports.search = async (req, res, next) => {
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
        next(err);
    }
};

// GET /api/products/deleted/all — list soft-deleted products (admin)
exports.getDeleted = async (req, res, next) => {
    try {
        const products = await Product.findAll({
            paranoid: false,
            where: { deleted_at: { [Op.ne]: null } },
            order: [['deleted_at', 'DESC']]
        });
        res.json(products);
    } catch (err) {
        next(err);
    }
};

// PATCH /api/products/:id/restore — restore a soft-deleted product (admin)
// PATCH /api/products/:id/restore — restore a soft-deleted product (admin)
exports.restore = async (req, res, next) => {
    try {
        const product = await Product.findByPk(req.params.id, { paranoid: false });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (!product.deleted_at) return res.status(400).json({ message: 'Product is not deleted' });

        await product.restore();
        res.json({ message: 'Product restored successfully' });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/products/:id/permanent — permanently delete (hard delete, admin)
exports.hardDelete = async (req, res, next) => {
    try {
        const product = await Product.findByPk(req.params.id, { paranoid: false });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await product.destroy({ force: true });
        res.json({ message: 'Product permanently deleted' });
    } catch (err) {
        next(err);
    }
};
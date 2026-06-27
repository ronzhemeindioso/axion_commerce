const Item = require('../sequelize/models/Item');
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

// GET all items
exports.getAll = async (req, res) => {
    try {
        const items = await Item.findAll();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET single item
exports.getOne = async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST create item
exports.create = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const images = req.files ? req.files.map(f => f.filename).join(',') : '';
        const item = await Item.create({ name, description, price, images });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT update item
exports.update = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const item = await Item.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const images = req.files && req.files.length > 0
            ? req.files.map(f => f.filename).join(',')
            : item.images;

        await item.update({ name, description, price, images });
        res.json({ message: 'Item updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE item
exports.delete = async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await item.destroy();
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
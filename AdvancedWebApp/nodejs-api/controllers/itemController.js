const db = require('../config/db');

// GET all items
exports.getAll = (req, res) => {
    db.query('SELECT * FROM items', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// GET single item
exports.getOne = (req, res) => {
    db.query('SELECT * FROM items WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Item not found' });
        res.json(results[0]);
    });
};

// POST create item
exports.create = (req, res) => {
    const { name, description, price } = req.body;
    db.query('INSERT INTO items (name, description, price) VALUES (?, ?, ?)',
        [name, description, price],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: results.insertId, name, description, price });
        });
};

// PUT update item
exports.update = (req, res) => {
    const { name, description, price } = req.body;
    db.query('UPDATE items SET name=?, description=?, price=? WHERE id=?',
        [name, description, price, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Item updated successfully' });
        });
};

// DELETE item
exports.delete = (req, res) => {
    db.query('DELETE FROM items WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item deleted successfully' });
    });
};
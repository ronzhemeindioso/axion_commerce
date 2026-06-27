const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your_secret_key_here';

// REGISTER
exports.register = (req, res) => {
    const { name, email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) return res.status(400).json({ message: 'Email already exists' });

        const hashedPassword = bcrypt.hashSync(password, 10);

        db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'User registered successfully' });
            });
    });
};

// LOGIN
exports.login = (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = results[0];

        if (!user.is_active) return res.status(403).json({ message: 'Account is deactivated' });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        db.query('UPDATE users SET token = ? WHERE id = ?', [token, user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                message: 'Login successful',
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        });
    });
};

// LOGOUT
exports.logout = (req, res) => {
    const { id } = req.body;

    db.query('UPDATE users SET token = NULL WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Logged out successfully' });
    });
};

// GET ALL USERS
exports.getAll = (req, res) => {
    db.query('SELECT id, name, email, role, is_active, created_at FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// UPDATE ROLE
exports.updateRole = (req, res) => {
    const { role } = req.body;
    db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Role updated successfully' });
    });
};

// DEACTIVATE / ACTIVATE USER
exports.toggleActive = (req, res) => {
    const { is_active } = req.body;
    db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: is_active ? 'User activated' : 'User deactivated' });
    });
};
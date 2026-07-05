const User = require('../sequelize/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, firstName, lastName, email, password } = req.body;
        const fullName = name || [firstName, lastName].filter(Boolean).join(' ');

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
            return res.status(400).json({ message: 'Please use a valid Gmail address' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email already exists' });

        const hashedPassword = bcrypt.hashSync(password, 10);

        const user = await User.create({ name: fullName, email, password: hashedPassword, role: 'user' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        await user.update({ token });

        res.status(201).json({
            message: 'User registered successfully',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// GET OWN PROFILE
exports.getProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const user = await User.findByPk(id, {
            attributes: [
                'id', 'name', 'email', 'role', 'username', 'phone', 'avatar',
                'address_line1', 'address_line2', 'city', 'province', 'zip_code', 'country'
            ]
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// SETUP PROFILE
exports.setupProfile = async (req, res) => {
    try {
        const {
            username, phone,
            addressLine1, addressLine2,
            city, province, zipCode, country,
            avatar
        } = req.body;
        const id = req.user.id;

        if (!username || !String(username).trim()) {
            return res.status(400).json({ message: 'Username is required' });
        }
        if (!addressLine1 || !String(addressLine1).trim()) {
            return res.status(400).json({ message: 'Address line 1 is required' });
        }
        if (!city || !String(city).trim()) {
            return res.status(400).json({ message: 'City / Municipality is required' });
        }
        if (!province || !String(province).trim()) {
            return res.status(400).json({ message: 'Province / State is required' });
        }
        if (!country || !String(country).trim()) {
            return res.status(400).json({ message: 'Country is required' });
        }
        if (!zipCode || !/^[0-9]{3,10}$/.test(String(zipCode).trim())) {
            return res.status(400).json({ message: 'ZIP / Postal code must contain numbers only' });
        }
        if (!phone || !/^\+?[0-9\-\s]{7,15}$/.test(String(phone).trim())) {
            return res.status(400).json({ message: 'Please enter a valid phone number' });
        }

        if (avatar) {
            const base64Data = String(avatar).split(',').pop() || '';
            const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
            const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
            if (sizeInBytes > MAX_AVATAR_BYTES) {
                return res.status(413).json({ message: 'Photo must be under 2 MB.' });
            }
        }

        await User.update(
            {
                username,
                phone,
                address_line1: addressLine1,
                address_line2: addressLine2,
                city,
                province,
                zip_code: zipCode,
                country,
                avatar
            },
            { where: { id } }
        );

        res.json({ message: 'Profile updated successfully' });
        } catch (err) {
                console.error('setupProfile error:', err.name, '-', err.message);
                const isPacketTooBig = err.message && err.message.toLowerCase().includes('max_allowed_packet');
                const friendlyMessage = isPacketTooBig
                    ? 'Your photo is too large for the server to accept right now. Please choose a smaller image.'
                    : (err.message || 'Something went wrong while saving your profile.');
                res.status(500).json({ message: friendlyMessage });
            }
        };

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.is_active) return res.status(403).json({ message: 'Account is deactivated' });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        await user.update({ token });

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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// LOGOUT
exports.logout = async (req, res) => {
    try {
        const id = req.user.id; // now from verified token, not client input
        await User.update({ token: null }, { where: { id } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET ALL USERS
exports.getAll = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'is_active', 'created_at']
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE ROLE
exports.updateRole = async (req, res) => {
    try {
        if (String(req.user.id) === String(req.params.id)) {
            return res.status(403).json({ message: 'You cannot change your own role.' });
        }

        const { role } = req.body;
        await User.update({ role }, { where: { id: req.params.id } });
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DEACTIVATE / ACTIVATE USER
exports.toggleActive = async (req, res) => {
    try {
        if (String(req.user.id) === String(req.params.id)) {
            return res.status(403).json({ message: 'You cannot change your own status.' });
        }

        const { is_active } = req.body;
        await User.update({ is_active }, { where: { id: req.params.id } });
        res.json({ message: is_active ? 'User activated' : 'User deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
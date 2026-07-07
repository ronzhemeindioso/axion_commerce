const User = require('../sequelize/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/mailer');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';

// Sends the "verify your email" link. Failures are logged but don't block
// registration — the user can still request a new link later if needed.
async function sendVerificationEmail(user, token) {
    const verifyUrl = `${APP_BASE_URL}/api/auth/verify-email?token=${token}`;
    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.MAIL_USER,
            to: user.email,
            subject: 'Verify your email address',
            html: `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background-color:#F1F2F4; font-family: Arial, Helvetica, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F2F4; padding: 30px 0;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:14px; overflow:hidden;">

                                <!-- Logo header -->
                                <tr>
                                    <td align="center" style="background-color:#FFFFFF; padding:28px 32px 20px 32px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                            <tr>
                                                <td style="width:36px; height:36px; border-radius:10px; background-color:#C1745B; text-align:center; vertical-align:middle;">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
                                                        <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
                                                        <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
                                                        <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
                                                        <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
                                                        <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
                                                    </svg>
                                                </td>
                                                <td style="width:10px;"></td>
                                                <td style="font-size:22px; font-weight:bold; color:#2B2220;">Axion</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Dark banner -->
                                <tr>
                                    <td align="center" style="background-color:#2B2220; padding:32px 32px 36px 32px;">
                                        <div style="width:44px; height:44px; line-height:44px; border-radius:50%; background-color:#3D1534; color:#FFF4EB; font-size:20px; margin:0 auto 16px auto;">&#9993;</div>
                                        <p style="margin:0 0 8px 0; color:#F6E0B6; font-size:12px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">Thanks for signing up!</p>
                                        <p style="margin:0; color:#FFFFFF; font-size:22px; font-weight:bold;">Verify Your E-mail Address</p>
                                    </td>
                                </tr>

                                <!-- Body -->
                                <tr>
                                    <td align="center" style="padding:36px 32px 8px 32px;">
                                        <p style="margin:0 0 16px 0; color:#2B2220; font-size:20px; font-weight:bold;">Hi ${user.name},</p>
                                        <p style="margin:0; color:#6B5850; font-size:14px; line-height:1.7;">
                                            You're almost ready to get started. Please click the button below to verify your email address and activate your account.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding:28px 32px 32px 32px;">
                                        <a href="${verifyUrl}"
                                           style="display:inline-block; background-color:#C1745B; color:#FFFFFF; text-decoration:none;
                                                  font-size:14px; font-weight:bold; letter-spacing:0.5px; padding:14px 40px; border-radius:14px;">
                                            VERIFY YOUR EMAIL
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding:0 32px 8px 32px;">
                                        <p style="margin:0; color:#948078; font-size:12px;">This link expires in 24 hours.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding:20px 32px 36px 32px;">
                                        <p style="margin:0; color:#2B2220; font-size:14px;">Thanks,</p>
                                        <p style="margin:0; color:#2B2220; font-size:14px; font-weight:bold;">The Axion Team</p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td align="center" style="background-color:#FAEFEA; padding:28px 32px;">
                                        <p style="margin:0 0 10px 0; color:#9C5844; font-size:14px; font-weight:bold;">Get in touch</p>
                                        <p style="margin:0 0 4px 0; color:#6B5850; font-size:13px;">+1 111 333 4444</p>
                                        <p style="margin:0; color:#6B5850; font-size:13px;">info@axion.com</p>
                                    </td>
                                </tr>

                                <!-- Bottom bar -->
                                <tr>
                                    <td align="center" style="background-color:#2B2220; padding:14px 32px;">
                                        <p style="margin:0; color:#F0DDD5; font-size:11px;">Copyright &copy; Axion. All Rights Reserved.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `
        });
    } catch (err) {
        console.error('Failed to send verification email:', err.message);
    }
}

// REGISTER
exports.register = async (req, res, next) => {
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

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        const user = await User.create({
            name: fullName,
            email,
            password: hashedPassword,
            role: 'user',
            is_verified: false,
            verification_token: verificationToken,
            verification_token_expires: verificationExpires
        });

        await sendVerificationEmail(user, verificationToken);

        // No JWT issued here — the account isn't usable until the email link is clicked.
        res.status(201).json({
            message: 'Registration successful! Please check your email to verify your account before logging in.'
        });
    } catch (err) {
        next(err);
    }
};

// VERIFY EMAIL — public link clicked from the email
exports.verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token) return res.redirect('/login?verified=0');

        const user = await User.findOne({ where: { verification_token: token } });

        if (!user || !user.verification_token_expires || user.verification_token_expires < new Date()) {
            return res.redirect('/login?verified=0');
        }

        await user.update({
            is_verified: true,
            verification_token: null,
            verification_token_expires: null
        });

        res.redirect('/login?verified=1');
    } catch (err) {
        res.redirect('/login?verified=0');
    }
};

// RESEND VERIFICATION EMAIL
exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        // Same response whether or not the account exists, so this can't be used to enumerate emails
        if (!user || user.is_verified) {
            return res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await user.update({
            verification_token: verificationToken,
            verification_token_expires: verificationExpires
        });

        await sendVerificationEmail(user, verificationToken);

        res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
    } catch (err) {
        next(err);
    }
};
// GET OWN PROFILE
exports.getProfile = async (req, res, next) => {
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
        next(err);
    }
};

// SETUP PROFILE
exports.setupProfile = async (req, res, next) => {
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
                avatar,
                has_seen_profile_setup: true
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

// SKIP PROFILE SETUP — user chose "Skip for now". No profile data is saved,
// but we still mark the setup screen as seen so login stops redirecting here.
exports.skipProfileSetup = async (req, res, next) => {
    try {
        await User.update(
            { has_seen_profile_setup: true },
            { where: { id: req.user.id } }
        );
        res.json({ message: 'Profile setup skipped' });
    } catch (err) {
        next(err);
    }
};

// LOGIN
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.is_active) return res.status(403).json({ message: 'Account is deactivated' });

        if (!user.is_verified) return res.status(403).json({ message: 'Please verify your email before logging in. Check your inbox for the verification link.' });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        await user.update({ token });

        // profileComplete drives the "no username yet" banner on /shop.
        const profileComplete = !!(user.username && user.username.trim());

        // hasSeenProfileSetup drives the one-time redirect to /setup-profile
        // after login. It's set the first time the user hits Save or Skip on
        // that screen, and stays true from then on — separate from
        // profileComplete, since a user can skip setup (seen = true) without
        // ever picking a username (profileComplete = false).
        const hasSeenProfileSetup = !!user.has_seen_profile_setup;

        res.json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileComplete,
                hasSeenProfileSetup
            }
        });
    } catch (err) {
        next(err);
    }
};

// LOGOUT
exports.logout = async (req, res, next) => {
    try {
        const id = req.user.id; // now from verified token, not client input
        await User.update({ token: null }, { where: { id } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
};

// GET ALL USERS
exports.getAll = async (req, res, next) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'is_active', 'created_at']
        });
        res.json(users);
    } catch (err) {
        next(err);
    }
};

// UPDATE ROLE
exports.updateRole = async (req, res, next) => {
    try {
        if (String(req.user.id) === String(req.params.id)) {
            return res.status(403).json({ message: 'You cannot change your own role.' });
        }

        const { role } = req.body;
        await User.update({ role }, { where: { id: req.params.id } });
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        next(err);
    }
};

// DEACTIVATE / ACTIVATE USER
exports.toggleActive = async (req, res, next) => {
    try {
        if (String(req.user.id) === String(req.params.id)) {
            return res.status(403).json({ message: 'You cannot change your own status.' });
        }

        const { is_active } = req.body;
        await User.update({ is_active }, { where: { id: req.params.id } });
        res.json({ message: is_active ? 'User activated' : 'User deactivated' });
    } catch (err) {
        next(err);
    }
};
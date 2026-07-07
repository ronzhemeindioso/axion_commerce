const Cart = require('../sequelize/models/Cart');
const Order = require('../sequelize/models/Order');
const OrderItem = require('../sequelize/models/OrderItem');
const Product = require('../sequelize/models/Product');
const User = require('../sequelize/models/User');

// GET all cart items for a user
exports.getCart = async (req, res) => {
    try {
        const user_id = req.params.user_id;
        const items = await Cart.findAll({ where: { user_id } });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ADD to cart
exports.addToCart = async (req, res) => {
    try {
        const { user_id, product_id, name, description, price, quantity, images } = req.body;

        const existing = await Cart.findOne({ where: { user_id, product_id } });
        if (existing) {
            await existing.update({ quantity: existing.quantity + (quantity || 1) });
            return res.json({ message: 'Cart updated successfully' });
        }

        const item = await Cart.create({
            user_id, product_id, name, description, price, quantity: quantity || 1, images
        });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE cart item quantity
exports.updateCart = async (req, res) => {
    try {
        const { quantity } = req.body;
        const item = await Cart.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'Cart item not found' });
        await item.update({ quantity });
        res.json({ message: 'Cart updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE cart item
exports.deleteCart = async (req, res) => {
    try {
        const item = await Cart.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'Cart item not found' });
        await item.destroy();
        res.json({ message: 'Item removed from cart' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// CHECKOUT - convert cart to order + decrement stock
exports.checkout = async (req, res) => {
    try {
        const { user_id, payment_method, billing } = req.body;

        // Same rules enforced client-side on setup-profile/edit-profile/checkout:
        // phone must be exactly 11 digits, ZIP exactly 4 digits, no letters.
        if (billing && typeof billing === 'object') {
            if (billing.phone && !/^[0-9]{11}$/.test(String(billing.phone).trim())) {
                return res.status(400).json({ message: 'Phone number must be exactly 11 numbers.' });
            }
            if (billing.zip_code && !/^[0-9]{4}$/.test(String(billing.zip_code).trim())) {
                return res.status(400).json({ message: 'ZIP / postal code must be exactly 4 numbers.' });
            }
        }

        const cartItems = await Cart.findAll({ where: { user_id } });
        if (cartItems.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // Check stock availability first
        for (const item of cartItems) {
            const product = await Product.findByPk(item.product_id);
            if (!product) {
                return res.status(404).json({ message: `Product "${item.name}" not found` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ message: `Not enough stock for "${item.name}". Available: ${product.stock}` });
            }
        }

        // Calculate total
        const total_amount = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        // payment_method comes from the checkout form's radio buttons ('card' / 'cod').
        const method = payment_method === 'cod' ? 'cod' : 'card';
        const payment_reference = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create order — the shipping snapshot below is what "where was this
        // order actually sent" means from now on. It's frozen at checkout time
        // and never touched again, so editing the profile later (or shipping
        // a different order to a different address) can't retroactively change
        // what a past order shows.
        const order = await Order.create({
            user_id,
            total_amount,
            payment_method: method,
            payment_reference,
            ship_first_name: billing?.first_name || null,
            ship_last_name: billing?.last_name || null,
            ship_email: billing?.email || null,
            ship_phone: billing?.phone || null,
            ship_address_line1: billing?.address_line1 || null,
            ship_address_line2: billing?.address_line2 || null,
            ship_city: billing?.city || null,
            ship_province: billing?.province || null,
            ship_zip_code: billing?.zip_code || null,
            ship_country: billing?.country || null
        });

        // Create order items + decrement stock
        for (const item of cartItems) {
            await OrderItem.create({
                order_id: order.id,
                product_id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: parseFloat(item.price) * item.quantity
            });

            await Product.decrement('stock', {
                by: item.quantity,
                where: { id: item.product_id }
            });
        }

        // Clear cart
        await Cart.destroy({ where: { user_id } });

        // Save the shipping/contact info back onto the user's profile — but only
        // when they explicitly ask for it (save_to_profile === true). By default
        // a checkout address is used for this order only and never touches the
        // profile, so someone can ship to a relative's house in another city
        // without their own saved address being overwritten.
        const saveToProfile = billing?.save_to_profile === true;
        if (billing && typeof billing === 'object' && saveToProfile) {
            const profileFields = {};
            if (billing.phone) profileFields.phone = billing.phone;
            if (billing.address_line1) profileFields.address_line1 = billing.address_line1;
            if (billing.address_line2) profileFields.address_line2 = billing.address_line2;
            if (billing.city) profileFields.city = billing.city;
            if (billing.province) profileFields.province = billing.province;
            if (billing.zip_code) profileFields.zip_code = billing.zip_code;
            if (billing.country) profileFields.country = billing.country;

            if (Object.keys(profileFields).length > 0) {
                await User.update(profileFields, { where: { id: user_id } });
            }
        }

        res.json({
            message: 'Order placed successfully!',
            order_id: order.id,
            total_amount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
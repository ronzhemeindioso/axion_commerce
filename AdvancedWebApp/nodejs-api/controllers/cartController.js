const Cart = require('../sequelize/models/Cart');
const Order = require('../sequelize/models/Order');
const OrderItem = require('../sequelize/models/OrderItem');
const Product = require('../sequelize/models/Product');

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
        const { user_id, payment_method } = req.body;

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

        // Create order
        const order = await Order.create({
            user_id,
            total_amount,
            payment_method: method,
            payment_reference
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

        res.json({
            message: 'Order placed successfully!',
            order_id: order.id,
            total_amount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
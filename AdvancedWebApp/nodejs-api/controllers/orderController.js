const Order = require('../sequelize/models/Order');
const OrderItem = require('../sequelize/models/OrderItem');
const User = require('../sequelize/models/User');
const Product = require('../sequelize/models/Product');
const transporter = require('../config/mailer');
const PDFDocument = require('pdfkit');

// GET all orders (admin)
exports.getAll = async (req, res) => {
    try {
        const orders = await Order.findAll({ order: [['created_at', 'DESC']] });

        // Attach each order's customer name so the admin table can display
        // and search by customer, not just by raw user_id.
        const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
        const users = await User.findAll({
            where: { id: userIds },
            attributes: ['id', 'name']
        });
        const nameMap = {};
        users.forEach(u => { nameMap[u.id] = u.name; });

        const ordersWithCustomer = orders.map(o => ({
            ...o.toJSON(),
            customer_name: nameMap[o.user_id] || null
        }));

        res.json(ordersWithCustomer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// GET analytics summary for dashboard charts (admin)
exports.getAnalytics = async (req, res) => {
    try {
        const orders = await Order.findAll();
        const items = await OrderItem.findAll();
        const products = await Product.findAll({ paranoid: false, attributes: ['id', 'category'] });

        const categoryByProduct = {};
        products.forEach(p => { categoryByProduct[p.id] = p.category || 'Uncategorized'; });

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const volumeByMonth = {};
        const revenueByMonth = {};
        monthNames.forEach(m => { volumeByMonth[m] = 0; revenueByMonth[m] = 0; });

        // Orders that were refunded, returned+refunded, or cancelled never
        // resulted in kept revenue, so they're counted toward volume but
        // excluded from revenue.
        const NON_REVENUE_STATUSES = ['refunded', 'return_refund', 'cancelled'];
        const isRevenueEligible = o => !NON_REVENUE_STATUSES.includes(o.status);
        const revenueEligibleOrderIds = new Set();

        orders.forEach(o => {
            const m = monthNames[new Date(o.created_at).getMonth()];
            volumeByMonth[m] += 1;
            if (isRevenueEligible(o)) {
                revenueByMonth[m] += parseFloat(o.total_amount) || 0;
                revenueEligibleOrderIds.add(o.id);
            }
        });

        const categoryRevenue = {};
        items.forEach(i => {
            if (!revenueEligibleOrderIds.has(i.order_id)) return;
            const cat = categoryByProduct[i.product_id] || 'Uncategorized';
            categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (parseFloat(i.subtotal) || 0);
        });

        res.json({
            monthlyVolume: monthNames.map(m => ({ month: m, count: volumeByMonth[m] })),
            revenueTrend: monthNames.map(m => ({ month: m, revenue: Math.round(revenueByMonth[m] * 100) / 100 })),
            categorySales: Object.entries(categoryRevenue).map(([category, revenue]) => ({
                category,
                revenue: Math.round(revenue * 100) / 100
            }))
        });
    } catch (err) {
        console.error('getAnalytics error:', err.name, '-', err.message);
        res.status(500).json({ message: err.message || 'Failed to load analytics.' });
    }
};

// GET orders by user_id
exports.getByUser = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { user_id: req.params.user_id },
            order: [['created_at', 'DESC']]
        });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET single order with items
exports.getOne = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const items = await OrderItem.findAll({ where: { order_id: order.id } });

        // Attach a thumbnail to each item, pulled from the current product record
        const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
        const products = await Product.findAll({
            where: { id: productIds },
            attributes: ['id', 'images']
        });
        const imageMap = {};
        products.forEach(p => {
            imageMap[p.id] = p.images ? p.images.split(',')[0] : null;
        });
        const itemsWithImages = items.map(i => ({
            ...i.toJSON(),
            image: imageMap[i.product_id] || null
        }));

        const user = await User.findByPk(order.user_id, {
            attributes: ['id', 'name', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'province', 'zip_code', 'country']
        });

        const orderCount = await Order.count({ where: { user_id: order.user_id } });

        res.json({
            ...order.toJSON(),
            items: itemsWithImages,
            customer: user,
            customerOrderCount: orderCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE order status + send email with PDF receipt
exports.updateStatus = async (req, res) => {
    try {
        const { status, email, trackingNumber } = req.body;
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Only statuses where the item physically comes back put stock back
        // on the shelf: "cancelled" (never shipped/kept) and "return_refund"
        // (customer sent the item back). Plain "refunded" means money was
        // returned but the item was NOT — e.g. a goodwill refund — so it must
        // NOT touch stock. Treat cancelled/return_refund as one "stock-
        // restoring" group so moving between the two never double-restocks.
        const STOCK_RESTORING_STATUSES = ['cancelled', 'return_refund'];
        const wasRestoring = STOCK_RESTORING_STATUSES.includes(order.status);
        const isNowRestoring = STOCK_RESTORING_STATUSES.includes(status);

        await order.update({ status, tracking_number: trackingNumber || null });

        // Restore stock exactly once, only on the transition INTO a
        // stock-restoring status — re-saving an already cancelled/refunded
        // order (e.g. adding a tracking number) must not restock again, and
        // hopping cancelled -> refunded (or vice versa) must not restock twice.
        if (isNowRestoring && !wasRestoring) {
            const restoredItems = await OrderItem.findAll({ where: { order_id: order.id } });
            for (const item of restoredItems) {
                await Product.increment('stock', {
                    by: item.quantity,
                    where: { id: item.product_id }
                });
            }
        }

        // Reverse that restock on the transition OUT of a stock-restoring
        // status — otherwise stock stays inflated after an order is
        // reinstated, and a later re-cancel/re-refund double-adds it back
        // (42 -> 43 -> 43 -> 44).
        if (wasRestoring && !isNowRestoring) {
            const reinstatedItems = await OrderItem.findAll({ where: { order_id: order.id } });
            for (const item of reinstatedItems) {
                await Product.decrement('stock', {
                    by: item.quantity,
                    where: { id: item.product_id }
                });
            }
        }

        const items = await OrderItem.findAll({ where: { order_id: order.id } });

        const pdfBuffer = await generateReceiptPDF(order, items);

        await transporter.sendMail({
            from: '"Shop Admin" <admin@shop.com>',
            to: email,
            subject: `Order #${order.id} has been ${status}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #1a1a2e;">Order Update</h2>
                    <p>Hi there,</p>
                    <p>Your order <strong>#${order.id}</strong> status has been updated to:
                        <strong style="text-transform: uppercase;">${status}</strong>
                    </p>
                    ${trackingNumber ? `<p>Tracking Number: <strong>${trackingNumber}</strong></p>` : ''}
                    <p>Total Amount: <strong>₱${parseFloat(order.total_amount).toFixed(2)}</strong></p>
                    <p>Please see the attached PDF for your full receipt.</p>
                    <hr>
                    <p style="color: gray; font-size: 12px;">Thank you for shopping with us!</p>
                </div>
            `,
            attachments: [
                {
                    filename: `receipt-order-${order.id}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        res.json({ message: `Status updated to "${status}" and receipt sent to ${email}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE order
exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        await OrderItem.destroy({ where: { order_id: order.id } });
        await order.destroy();
        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper — generate PDF in memory
function generateReceiptPDF(order, items) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.fontSize(22).font('Helvetica-Bold').text('ORDER RECEIPT', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        doc.text(`Order ID:  #${order.id}`);
        doc.text(`Status:    ${order.status.toUpperCase()}`);
        doc.text(`Date:      ${new Date(order.created_at).toLocaleString()}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('ITEMS ORDERED:', { underline: true });
        doc.moveDown(0.5);

        doc.font('Helvetica');
        items.forEach((item, i) => {
            doc.text(
                `${i + 1}.  ${item.name}   Qty: ${item.quantity}   Price: ₱${parseFloat(item.price).toFixed(2)}   Subtotal: ₱${parseFloat(item.subtotal).toFixed(2)}`
            );
        });

        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(14)
            .text(`TOTAL:  ₱${parseFloat(order.total_amount).toFixed(2)}`, { align: 'right' });

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(10).fillColor('gray')
            .text('Thank you for your order!', { align: 'center' });

        doc.end();
    });
}
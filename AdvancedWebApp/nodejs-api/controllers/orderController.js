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
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        const { status, email } = req.body;
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        await order.update({ status });

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
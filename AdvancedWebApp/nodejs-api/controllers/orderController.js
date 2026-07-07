const Order = require('../sequelize/models/Order');
const OrderItem = require('../sequelize/models/OrderItem');
const User = require('../sequelize/models/User');
const Product = require('../sequelize/models/Product');
const transporter = require('../config/mailer');
const PDFDocument = require('pdfkit');

function derivePaymentStatus(status, paymentMethod) {
    if (status === 'refunded' || status === 'return_refund') return 'refunded';

    if (paymentMethod === 'card') {
        return status === 'cancelled' ? 'refunded' : 'paid';
    }

    // Cash on Delivery: no money changes hands until the order is delivered.
    if (status === 'cancelled') return 'unpaid';
    return status === 'delivered' ? 'paid' : 'unpaid';
}

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

        const orderJson = order.toJSON();

        // The address this specific order was actually shipped to — frozen at
        // checkout time. Distinct from `customer`, which is the account's
        // current profile and can have since been edited. Orders placed before
        // this snapshot existed will have all-null fields here; the frontend
        // should treat that as "not recorded" rather than falling back to the
        // live profile, since that's exactly the ambiguity this fixes.
        const shipping = {
            first_name: orderJson.ship_first_name,
            last_name: orderJson.ship_last_name,
            email: orderJson.ship_email,
            phone: orderJson.ship_phone,
            address_line1: orderJson.ship_address_line1,
            address_line2: orderJson.ship_address_line2,
            city: orderJson.ship_city,
            province: orderJson.ship_province,
            zip_code: orderJson.ship_zip_code,
            country: orderJson.ship_country
        };

        res.json({
            ...orderJson,
            items: itemsWithImages,
            customer: user,
            shipping,
            customerOrderCount: orderCount,
            payment_status: derivePaymentStatus(order.status, order.payment_method)
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


        const STOCK_RESTORING_STATUSES = ['cancelled', 'return_refund'];
        const wasRestoring = STOCK_RESTORING_STATUSES.includes(order.status);
        const isNowRestoring = STOCK_RESTORING_STATUSES.includes(status);

        const tracking_number = ['shipped', 'delivered'].includes(status) ? (trackingNumber || null) : null;
        await order.update({ status, tracking_number });

        if (isNowRestoring && !wasRestoring) {
            const restoredItems = await OrderItem.findAll({ where: { order_id: order.id } });
            for (const item of restoredItems) {
                await Product.increment('stock', {
                    by: item.quantity,
                    where: { id: item.product_id }
                });
            }
        }

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
        const customer = await User.findByPk(order.user_id, {
            attributes: ['name', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'province', 'zip_code', 'country']
        });

        const pdfBuffer = await generateReceiptPDF(order, items, customer);

        const STATUS_CONTENT = {
            pending:       { title: 'Order Received!',        message: 'Thanks for your order! We\'ll let you know as soon as it\'s confirmed.', color: '#C1745B', badge: '#FAEFEA' },
            confirmed:     { title: 'Thank You For Your Order!', message: 'We\'ve confirmed your order and we\'re getting it ready.', color: '#C1745B', badge: '#FAEFEA' },
            processing:    { title: 'Your Order Is Being Prepared', message: 'Your order is being packed and will ship soon.', color: '#C1745B', badge: '#FAEFEA' },
            shipped:       { title: 'Your Order Has Shipped!', message: 'Your order is on its way to you.', color: '#9C5844', badge: '#FAEFEA' },
            delivered:     { title: 'Delivered!',              message: 'Your order has been delivered. We hope you love it!', color: '#1EA672', badge: '#E7F8F1' },
            cancelled:     { title: 'Order Cancelled',         message: 'Your order has been cancelled.', color: '#D6483F', badge: '#FBEBEA' },
            refunded:      { title: 'Order Refunded',          message: 'Your refund has been processed.', color: '#C97A1E', badge: '#FBF0E1' },
            return_refund: { title: 'Return Refunded',         message: 'Your return has been processed and refunded.', color: '#C97A1E', badge: '#FBF0E1' }
        };
        const statusInfo = STATUS_CONTENT[status] || { title: 'Order Update', message: `Your order status has been updated to ${status}.`, color: '#C1745B', badge: '#FAEFEA' };

        const itemsHtml = items.map(item => `
                                <tr>
                                    <td style="padding:14px 32px; border-bottom:1px solid #F8EFEA; color:#2B2220; font-size:14px;">${item.name} <span style="color:#948078;">(${item.quantity})</span></td>
                                    <td align="right" style="padding:14px 32px; border-bottom:1px solid #F8EFEA; color:#2B2220; font-size:14px;">&#8369;${parseFloat(item.subtotal).toFixed(2)}</td>
                                </tr>`).join('');

        const addressHtml = customer && customer.address_line1 ? `
                                            ${customer.address_line1}<br>
                                            ${customer.address_line2 ? customer.address_line2 + '<br>' : ''}
                                            ${customer.city}, ${customer.province} ${customer.zip_code}<br>
                                            ${customer.country || ''}
                                        ` : 'No address on file';

        await transporter.sendMail({
            from: '"Shop Admin" <admin@shop.com>',
            to: email,
            subject: `Order #${order.id} has been ${status}`,
            html: `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background-color:#F1F2F4; font-family: Arial, Helvetica, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F2F4; padding: 30px 0;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:14px; overflow:hidden;">

                                <!-- Top bar -->
                                <tr>
                                    <td style="background-color:#2B2220; padding:20px 32px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="left">
                                                    <table role="presentation" cellpadding="0" cellspacing="0">
                                                        <tr>
                                                            <td style="width:32px; height:32px; border-radius:9px; background-color:#C1745B; text-align:center; vertical-align:middle;">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
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
                                                            <td style="font-size:18px; font-weight:bold; color:#FFFFFF;">Axion</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Status icon + title -->
                                <tr>
                                    <td align="center" style="padding:44px 32px 8px 32px;">
                                        <div style="width:72px; height:72px; line-height:72px; border-radius:50%; background-color:${statusInfo.badge}; margin:0 auto 24px auto;">
                                            <span style="font-size:30px; color:${statusInfo.color};">&#10003;</span>
                                        </div>
                                        <p style="margin:0 0 14px 0; color:${statusInfo.color}; font-size:24px; font-weight:bold;">${statusInfo.title}</p>
                                        <p style="margin:0; color:#948078; font-size:14px; line-height:1.6; max-width:400px;">${statusInfo.message}</p>
                                    </td>
                                </tr>

                                <!-- Order confirmation number -->
                                <tr>
                                    <td style="padding:32px 32px 0 32px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAEFEA; border-radius:10px;">
                                            <tr>
                                                <td style="padding:16px 20px; color:#2B2220; font-size:14px; font-weight:bold;">Order Confirmation No.</td>
                                                <td align="right" style="padding:16px 20px; color:#2B2220; font-size:14px; font-weight:bold;">#${order.id}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Items -->
                                <tr>
                                    <td style="padding-top:8px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            ${itemsHtml}
                                        </table>
                                    </td>
                                </tr>

                                <!-- Total -->
                                <tr>
                                    <td style="padding:18px 32px 32px 32px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color:#2B2220; font-size:15px; font-weight:bold;">TOTAL</td>
                                                <td align="right" style="color:#2B2220; font-size:15px; font-weight:bold;">&#8369;${parseFloat(order.total_amount).toFixed(2)}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Delivery + tracking -->
                                <tr>
                                    <td style="padding:0 32px 36px 32px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width:50%; vertical-align:top; color:#6B5850; font-size:13px; line-height:1.7;">
                                                    <p style="margin:0 0 6px 0; color:#2B2220; font-size:13px; font-weight:bold;">Delivery Address</p>
                                                    ${addressHtml}
                                                </td>
                                                ${tracking_number ? `
                                                <td style="width:50%; vertical-align:top; color:#6B5850; font-size:13px; line-height:1.7;">
                                                    <p style="margin:0 0 6px 0; color:#2B2220; font-size:13px; font-weight:bold;">Tracking Number</p>
                                                    ${tracking_number}
                                                </td>` : ''}
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Banner -->
                                <tr>
                                    <td align="center" style="background-color:#2B2220; padding:36px 32px;">
                                        <p style="margin:0; color:#FFFFFF; font-size:15px;">Please see the attached PDF for your full receipt.</p>
                                        <p style="margin:8px 0 0 0; color:#F0DDD5; font-size:13px;">Thanks for shopping with us!</p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td align="center" style="background-color:#F1F2F4; padding:24px 32px;">
                                        <p style="margin:0 0 12px 0; color:#948078; font-size:12px;">Any address information, legal, terms etc to be added here</p>
                                        <p style="margin:0; font-size:12px;">
                                            <span style="color:#6B5850; text-decoration:underline;">Email Preferences</span>
                                            <span style="color:#948078;">&nbsp;|&nbsp;</span>
                                            <span style="color:#6B5850; text-decoration:underline;">Unsubscribe</span>
                                            <span style="color:#948078;">&nbsp;|&nbsp;</span>
                                            <span style="color:#6B5850; text-decoration:underline;">View Online</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
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
function generateReceiptPDF(order, items, customer) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        // Palette
        const INK = '#2B2220';
        const MUTED = '#948078';
        const MUTED_STRONG = '#6B5850';
        const FAINT = '#F0DDD5';
        const LINE = '#F8EFEA';
        const ACCENT = '#C1745B';
        const ACCENT_DARK = '#9C5844';
        const ACCENT_SOFT = '#FAEFEA';
        const NEUTRAL_SOFT = '#F1F2F4';

        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const left = 50;
        const right = 545;
        const fullWidth = right - left;

        // ---- Header / logo ----
        doc.fontSize(24).font('Helvetica-Bold').fillColor(INK).text('Axion', left, 50);
        doc.fontSize(8).font('Helvetica').fillColor(MUTED)
            .text('O N L I N E   S T O R E', left, 78);

        // ---- Headline ----
        doc.fontSize(19).font('Helvetica-Bold').fillColor(INK)
            .text('Thank you for shopping with Axion.', left, 120, { width: fullWidth, align: 'center' });

        doc.fontSize(10).font('Helvetica').fillColor(MUTED_STRONG)
            .text(
                `You'll find your order summary below. If you have any questions regarding your order, please contact us at ${customer && customer.phone ? customer.phone : 'our support line'}.`,
                left, 150, { width: fullWidth, align: 'center' }
            );

        // ---- Order info (left) + company info (right) ----
        let y = 200;
        const colWidth = fullWidth / 2;

        doc.fontSize(10);
        const infoRow = (label, value, x, yy) => {
            doc.font('Helvetica-Bold').fillColor(INK).text(label, x, yy, { continued: false });
            doc.font('Helvetica').fillColor(MUTED_STRONG).text(value, x + 90, yy);
        };

        infoRow('Order Status', order.status.toUpperCase(), left, y);
        infoRow('Order No.', `#${order.id}`, left, y + 18);
        infoRow('Date', new Date(order.created_at).toLocaleDateString(), left, y + 36);

        doc.font('Helvetica-Bold').fillColor(INK).text('Axion', left + colWidth, y);
        doc.font('Helvetica').fillColor(MUTED_STRONG)
            .text(`Email: support@axion.com`, left + colWidth, y + 18)
            .text(`Phone: +1 111 333 4444`, left + colWidth, y + 36);

        // ---- Customer details header ----
        y += 70;
        doc.rect(left, y, fullWidth, 20).fill(NEUTRAL_SOFT);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
            .text('Customer Details', left + 8, y + 5);

        y += 30;
        const addrLines = customer && customer.address_line1
            ? [
                customer.address_line1,
                customer.address_line2,
                `${customer.city || ''}, ${customer.province || ''} ${customer.zip_code || ''}`,
                customer.country
            ].filter(Boolean)
            : ['No address on file'];

        doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text('Name:', left, y);
        doc.font('Helvetica').fillColor(MUTED_STRONG).text(customer && customer.name ? customer.name : '—', left + 70, y);
        doc.font('Helvetica-Bold').fillColor(INK).text('Phone:', left, y + 16);
        doc.font('Helvetica').fillColor(MUTED_STRONG).text(customer && customer.phone ? customer.phone : '—', left + 70, y + 16);
        doc.font('Helvetica-Bold').fillColor(INK).text('Address:', left, y + 32);
        doc.font('Helvetica').fillColor(MUTED_STRONG).text(addrLines.join('\n'), left + 70, y + 32, { width: colWidth - 30 });

        if (order.tracking_number) {
            doc.font('Helvetica-Bold').fillColor(INK).text('Tracking No.:', left + colWidth + 20, y);
            doc.font('Helvetica').fillColor(MUTED_STRONG).text(order.tracking_number, left + colWidth + 110, y);
        }

        // ---- Item Details table ----
        y = Math.max(doc.y, y + 32 + addrLines.length * 14) + 30;
        doc.rect(left, y, fullWidth, 20).fill(NEUTRAL_SOFT);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
            .text('Item', left + 8, y + 5)
            .text('Qty', left + 230, y + 5, { width: 40, align: 'right' })
            .text('Unit Price', left + 300, y + 5, { width: 80, align: 'right' })
            .text('Subtotal', left + 405, y + 5, { width: 90, align: 'right' });

        y += 30;
        doc.font('Helvetica').fillColor(MUTED_STRONG);
        items.forEach(item => {
            doc.text(item.name, left + 8, y, { width: 210 });
            doc.text(String(item.quantity), left + 230, y, { width: 40, align: 'right' });
            doc.text(`PHP ${parseFloat(item.price).toFixed(2)}`, left + 300, y, { width: 80, align: 'right' });
            doc.fillColor(INK).text(`PHP ${parseFloat(item.subtotal).toFixed(2)}`, left + 405, y, { width: 90, align: 'right' });
            doc.fillColor(MUTED_STRONG);
            y += 22;
        });

        // ---- Total box ----
        y += 14;
        doc.moveTo(left + 300, y).lineTo(right, y).strokeColor(LINE).stroke();
        y += 12;
        doc.font('Helvetica-Bold').fontSize(12).fillColor(INK)
            .text('TOTAL', left + 230, y, { width: 160 })
            .text(`PHP ${parseFloat(order.total_amount).toFixed(2)}`, left + 405, y, { width: 90, align: 'right' });

        // ---- Footer ----
        y += 60;
        doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
        doc.fontSize(9).font('Helvetica').fillColor(MUTED)
            .text('Thank you for shopping with Axion.', left, y + 14, { width: fullWidth, align: 'center' });

        doc.end();
    });
}
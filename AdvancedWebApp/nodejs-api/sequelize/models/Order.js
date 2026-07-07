const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'return_refund'),
        defaultValue: 'pending'
    },
    tracking_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: true
    },
    payment_reference: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // Shipping snapshot — captured from the checkout form at the moment the
    // order was placed. Deliberately separate from the User's profile fields:
    // a customer may ship an order to a different address than what's saved
    // on their account, and editing the profile later should never rewrite
    // where a past order was actually sent.
    ship_first_name: { type: DataTypes.STRING, allowNull: true },
    ship_last_name: { type: DataTypes.STRING, allowNull: true },
    ship_email: { type: DataTypes.STRING, allowNull: true },
    ship_phone: { type: DataTypes.STRING, allowNull: true },
    ship_address_line1: { type: DataTypes.STRING, allowNull: true },
    ship_address_line2: { type: DataTypes.STRING, allowNull: true },
    ship_city: { type: DataTypes.STRING, allowNull: true },
    ship_province: { type: DataTypes.STRING, allowNull: true },
    ship_zip_code: { type: DataTypes.STRING, allowNull: true },
    ship_country: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Order;
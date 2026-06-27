const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING
    },
    price: {
        type: DataTypes.DECIMAL(8, 2)
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2)
    }
}, {
    tableName: 'order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = OrderItem;
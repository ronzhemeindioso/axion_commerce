const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Cart = sequelize.define('Cart', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    price: {
        type: DataTypes.DECIMAL(8, 2),
        defaultValue: 0
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    images: {
        type: DataTypes.STRING(1000)
    }
}, {
    tableName: 'cart',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Cart;
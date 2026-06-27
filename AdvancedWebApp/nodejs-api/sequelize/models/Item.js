const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
    images: {
        type: DataTypes.STRING(1000)
    }
}, {
    tableName: 'items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Item;
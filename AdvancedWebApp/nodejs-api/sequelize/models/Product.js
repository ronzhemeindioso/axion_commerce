const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Product = sequelize.define('Product', {
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
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    category: {
        type: DataTypes.STRING
    },
    images: {
        type: DataTypes.STRING(1000)
    }
}, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,          // enables soft delete
    deletedAt: 'deleted_at'  // column used to mark deletion
});

module.exports = Product;
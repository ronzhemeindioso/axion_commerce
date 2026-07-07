const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'user'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verification_token: {
        type: DataTypes.STRING,
        allowNull: true
    },
    verification_token_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    token: {
        type: DataTypes.STRING(1000),
        allowNull: true
    },

    avatar: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },

    username: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // True once the user has been through the setup-profile screen at least
    // once (whether they hit Save or Skip). Login uses this — not
    // profileComplete — to decide whether to redirect there again, so a user
    // who deliberately skips isn't nagged on every subsequent login.
    has_seen_profile_setup: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },

    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
    address_line1: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address_line2: {
        type: DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    province: {
        type: DataTypes.STRING,
        allowNull: true
    },
    zip_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = User;
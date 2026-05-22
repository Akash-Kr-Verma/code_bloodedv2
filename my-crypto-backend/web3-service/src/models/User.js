const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    wallet_address: { type: DataTypes.TEXT, unique: true, allowNull: false, lowercase: true },
    email: { type: DataTypes.TEXT, unique: true, allowNull: false },
    temp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    tableName: 'users',
    underscored: true
});

module.exports = User;
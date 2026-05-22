const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Nonce = sequelize.define('Nonce', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    nonce: { type: DataTypes.TEXT, allowNull: true },
    userId: {
        type: DataTypes.BIGINT,
        field: 'user_id',
        allowNull: false,
        references: { model: User, key: 'id' }
    }
}, {
    tableName: 'nonce',
    underscored: true
});

// ✅ FIX: Explicitly add matching aliases 'as' to prevent eager loading errors
User.hasOne(Nonce, { foreignKey: 'userId', as: 'Nonce', onDelete: 'CASCADE' });
Nonce.belongsTo(User, { foreignKey: 'userId', as: 'User' });

module.exports = Nonce;
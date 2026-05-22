const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: {
        type: DataTypes.BIGINT,
        field: 'user_id',
        allowNull: false,
        references: { model: User, key: 'id' }
    },
    tx_hash: { type: DataTypes.STRING(255), unique: true, allowNull: false, lowercase: true },
    network: { type: DataTypes.STRING(50), allowNull: false },
    from_address: { type: DataTypes.STRING(255), allowNull: false, lowercase: true },
    to_address: { type: DataTypes.STRING(255), allowNull: false, lowercase: true },
    amount: { type: DataTypes.NUMERIC(78, 18), allowNull: false },
    token_symbol: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ETH' },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'PENDING' }
}, {
    tableName: 'transactions',
    underscored: true,
    timestamps: false
});

// ✅ FIX: Match the relation layout precisely
User.hasMany(Transaction, { foreignKey: 'userId', as: 'Transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'User' });

module.exports = Transaction;
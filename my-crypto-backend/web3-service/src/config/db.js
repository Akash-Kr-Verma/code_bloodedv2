const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/wallet_db';

const sequelize = new Sequelize(DB_URL, {
  dialect: 'postgres',
  logging: false,

  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },

  // Better pool settings for Supabase / PgBouncer stability
  pool: {
    max: 10,
    min: 0,
    acquire: 60000,
    idle: 10000,
    evict: 10000,
  },

  // IMPORTANT: prevents prepared statement issues with Supabase pooler
  define: {
    freezeTableName: true,
    timestamps: false,
  },
});

module.exports = sequelize;
const { Client } = require('pg');

async function tryConnect(connectionString) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    return client;
  } catch (err) {
    // console.log(`Failed connecting with ${connectionString}: ${err.message}`);
    return null;
  }
}

async function main() {
  const options = [
    'postgresql://postgres@localhost:5432/postgres',
    'postgresql://postgres:postgres@localhost:5432/postgres',
    'postgresql://postgres:password@localhost:5432/postgres',
    'postgresql://postgres:admin@localhost:5432/postgres',
    'postgresql://postgres:root@localhost:5432/postgres'
  ];

  let client = null;
  for (const opt of options) {
    client = await tryConnect(opt);
    if (client) {
      console.log(`Successfully connected using: ${opt.replace(/:[^@/]+@/, ':***@')}`);
      break;
    }
  }

  if (!client) {
    console.error('Could not connect to PostgreSQL using common credentials. Please check if PostgreSQL is running with a custom password.');
    return;
  }

  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='wallet_db'");
    if (res.rowCount === 0) {
      console.log('Database wallet_db does not exist. Creating...');
      await client.query('CREATE DATABASE wallet_db');
      console.log('Database wallet_db created successfully.');
    } else {
      console.log('Database wallet_db already exists.');
    }
  } catch (err) {
    console.error('Error during database operation:', err);
  } finally {
    await client.end();
  }
}

main();

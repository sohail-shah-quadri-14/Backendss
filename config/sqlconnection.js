import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

//  Create Sequelize Instance with Connection Pooling
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: false, // Enable query logging

    pool: {
      max: 50, // As our aws rds supports 60 max connections
      min: 5,
      acquire: 20000, //If no connection is available within 30 seconds, the request fails and throws a tmeout error
      idle: 10000 // Close connections that remain idle for 10 sec
    },
  }
);

//  Test Database Connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate()
    console.log(' Database Connected Successfully!');
  } catch (error) {
    console.error(' Unable to connect to the database:', error);
    process.exit(1); // Stop app if DB fails
  }
};

//  Close Connection (Used when shutting down the app)
export const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log(' Database Connection Closed Successfully!');
  } catch (error) {
    console.error(' Unable to close the database connection:', error);
  }
};

//  Sync Database Models (ONLY Run on Startup!)
export const syncDatabase = async () => {
  try {
    await sequelize.sync(); //  Creates tables if they don’t // use {force : true inside of sync to remove tables and create new one  
    console.log(' Database Synced Successfully!');
  } catch (error) {
    console.error(' Error syncing database:', error);
  }
};

export { sequelize };

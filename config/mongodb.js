import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;


export const connectToDatabase = async () => {
  if (isConnected) {
    console.log('=> Using existing database connection');
    return;
  }

  try {
    // Use the MongoDB connection string from .env file
    const db = await mongoose.connect(process.env.MONGODB_URI);

    isConnected = db.connections[0].readyState;
    console.log('=> Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('=> Error connecting to MongoDB:', error);
    throw error;
  }
};

/**
 * Close MongoDB connection
 */
export const closeDatabaseConnection = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('=> MongoDB connection closed');
  } catch (error) {
    console.error('=> Error closing MongoDB connection:', error);
    throw error;
  }
};

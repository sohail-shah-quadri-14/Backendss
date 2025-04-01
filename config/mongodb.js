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
    const options = {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 5,  // Minimum number of connections in the pool
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    // Use the MongoDB connection string from .env file
    const db = await mongoose.connect(process.env.MONGODB_URI, options);

    isConnected = db.connections[0].readyState;
    console.log('=> Connected to MongoDB with connection pool');
    
    // Log connection status
    console.log('=> MongoDB connection status:', {
      readyState: db.connections[0].readyState,
      host: db.connections[0].host,
      port: db.connections[0].port,
      name: db.connections[0].name
    });

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
    console.log('=> MongoDB connection pool closed');
  } catch (error) {
    console.error('=> Error closing MongoDB connection:', error);
    throw error;
  }
};

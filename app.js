import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import AuthRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import { testConnection, syncDatabase } from "./config/sqlconnection.js";
import { Server } from "socket.io";
import UserRoutes from "./routes/userProfileRoutes.js";
import EventRoutes from "./routes/eventRoutes.js";
import http from 'http';
import { initSocketIO } from './utils/socketio.js';
import { connectToDatabase } from './config/mongodb.js';
import DashboardRoutes from "./routes/dashboardRoutes.js";
dotenv.config(); // Load environment variables
import compression from 'compression';

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8081", // Frontend location
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true // Allow cookies
  },
  cookie: {
    name: "jwt",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none"
  }
});

// Make io accessible from other files
global.io = io;

// Initialize socket.io handlers
initSocketIO(io);


app.use(compression());
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:8081", "http://52.203.42.98:8000", "http://52.203.42.98"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
  })
);

app.use(express.json()); // Allow JSON data

// API Routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/events", EventRoutes);
app.use("/api/v1/dashboard", DashboardRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Howzdat API is running' });
});

// Open Database Connection & Sync Models
const startServer = async () => {
  try {
    // Connect to SQL database
    await testConnection(); // Check DB connection
    await syncDatabase(); // Use with caution in production
    
    // Connect to MongoDB (for questions)
    await connectToDatabase();

    server.listen(port, () => {
      console.log(` Server is running on port ${port}`);
    });
  } catch (error) {
    console.error(" Server failed to start:", error);
  }
};

startServer();

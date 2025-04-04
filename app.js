import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import AuthRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import { testConnection, syncDatabase } from "./config/sqlconnection.js";
import { Server } from "socket.io";
import { initSocketIO } from "./utils/socketio.js";
import UserRoutes from "./routes/userProfileRoutes.js";
import EventRoutes from "./routes/eventRoutes.js";
import AdminRoutes from "./routes/adminRoutes.js";
import http from 'http';
import compression from 'compression';
import DashboardRoutes from "./routes/dashboardRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this later
    methods: ["GET", "POST"]
  }
});

// Initialize WebSockets
initSocketIO(io);


app.use(compression());
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:8081", "http://52.203.42.98:8000", "http://52.203.42.98"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
    maxAge: 86400
  })
);

app.use(express.json()); // Allow JSON data

// API Routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/events", EventRoutes);
app.use("/api/v1/dashboard", DashboardRoutes);
app.use("/api/v1/admin", AdminRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Howzdat API is running' });
});

// Open Database Connection & Start Server
const startServer = async () => {
  try {
    await testConnection();
    await syncDatabase();

    server.listen(port, () => {
      console.log(` Server is running on port ${port}`);
    });
  } catch (error) {
    console.error(" Server failed to start:", error);
  }
};

startServer();

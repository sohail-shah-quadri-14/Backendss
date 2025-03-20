import express from "express";
import { authenticate } from "../middleware/authmiddleware.js";
import { getStudentDashboard } from "../controller/dashboardController.js";

const router = express.Router();

// Get student dashboard
router.get("/student", authenticate, getStudentDashboard);

export default router; 
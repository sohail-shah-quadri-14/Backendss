import express from "express";
import { authenticate } from "../middleware/authmiddleware.js";
import { 
  getStudentStats, 
  getRSVPdEvents, 
} from "../controller/eventController/dashboardController.js";
const router = express.Router();




// Dashboard routes
router.get("/stats", authenticate, getStudentStats);
router.get("/rsvpd-events", authenticate, getRSVPdEvents);


export default router; 